/**
 * Sprint 9a: the calendar builds itself (PRODUCT_LOGIC §15). Rent, cleaning,
 * shopping, travel and chores appear on their days without anyone typing them,
 * read-only and linked to their page. Dates are fixed (2027).
 */
import { describe, it, expect } from "vitest";
import { GET as calendarRoute } from "@/app/api/apartments/[id]/calendar/route";
import { DELETE as deleteEventRoute } from "@/app/api/apartments/[id]/calendar/[eventId]/route";
import { generatedEntries } from "@/lib/calendarFeed";
import { startRentMonth } from "@/lib/rent";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const NOW = new Date("2027-03-10T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** Alex (admin, rent payer, first to shop), Sam and Kim. */
async function household() {
  const alex = await createUser();
  const sam = await createUser();
  const kim = await createUser();
  const apt = await createApartment(alex.user.id);
  const t = Date.now();
  await prisma.apartmentMember.createMany({ data: [
    { apartmentId: apt.id, userId: sam.user.id, joinedAt: new Date(t + 1000) },
    { apartmentId: apt.id, userId: kim.user.id, joinedAt: new Date(t + 2000) },
  ] });
  await prisma.user.update({ where: { id: alex.user.id }, data: { name: "Alex" } });
  await prisma.user.update({ where: { id: sam.user.id }, data: { name: "Sam" } });
  await prisma.user.update({ where: { id: kim.user.id }, data: { name: "Kim" } });
  return { alex, sam, kim, apt };
}

describe("generated calendar entries", () => {
  it("rent, cleaning, shopping, travel and chores land on their days, read-only and linked", async () => {
    const { alex, sam, kim, apt } = await household();
    const base = `/apartment/${apt.id}`;
    await prisma.rentConfig.create({ data: { apartmentId: apt.id, totalAmount: 1200, dueDay: 23, rentPayerId: alex.user.id } });
    await startRentMonth(apt.id, "2027-03");
    const rotation = await prisma.cleaningRotation.create({
      data: { apartmentId: apt.id, name: "Cleaning", frequency: "WEEKLY", memberOrder: JSON.stringify([sam.user.id, kim.user.id]), currentIndex: 0, nextDue: day("2027-03-12") },
    });
    await prisma.cleaningLog.create({ data: { apartmentId: apt.id, rotationId: rotation.id, cleanedById: sam.user.id, cleanedAt: day("2027-03-05") } });
    await prisma.travelPeriod.create({ data: { apartmentId: apt.id, userId: kim.user.id, startDate: day("2027-03-18"), endDate: day("2027-03-20") } });
    await prisma.shoppingTrip.create({ data: { apartmentId: apt.id, shopperId: alex.user.id, status: "COMPLETED", totalAmount: 30, startedAt: day("2027-03-08"), endedAt: day("2027-03-08") } });
    await prisma.chore.create({ data: { apartmentId: apt.id, title: "Take out trash", assignedUserId: kim.user.id, dueDate: day("2027-03-15") } });

    const entries = await generatedEntries(apt.id, NOW);
    const at = (title: string) => entries.find(e => e.title === title);
    expect(entries.every(e => e.auto && e.allDay && e.href.startsWith(base))).toBe(true);

    expect(at("Rent due · $1200.00")).toBeTruthy();
    const march = entries.find(e => e.id === "auto:rent:2027-03")!;
    expect(march).toMatchObject({ startDate: "2027-03-23T12:00:00.000Z", notes: "Landlord not paid yet · $800.00 still to collect", href: `${base}/rent` });
    expect(entries.filter(e => e.type === "RENT").map(e => e.id)).toEqual(["auto:rent:2027-03", "auto:rent:2027-04", "auto:rent:2027-05", "auto:rent:2027-06"]);

    const cleaning = entries.filter(e => e.id.startsWith("auto:cleaning:"));
    expect(cleaning[0]).toMatchObject({ title: "Cleaning: Sam", startDate: "2027-03-12T12:00:00.000Z", notes: "Current turn", href: `${base}/cleaning` });
    expect(cleaning[1]).toMatchObject({ title: "Cleaning: Sam", startDate: "2027-03-19T12:00:00.000Z" }); // Kim is away that week
    expect(at("Cleaned by Sam")?.startDate).toBe("2027-03-05T12:00:00.000Z");

    expect(at("Shopping: Alex · $30.00")).toMatchObject({ startDate: "2027-03-08T12:00:00.000Z", href: `${base}/shopping` });
    expect(at("Alex's turn to shop")?.startDate).toBe("2027-03-10T12:00:00.000Z");
    expect(at("Kim away")).toMatchObject({ startDate: "2027-03-18T12:00:00.000Z", endDate: "2027-03-20T12:00:00.000Z", href: `${base}/members` });
    expect(at("Chore: Take out trash (Kim)")).toMatchObject({ startDate: "2027-03-15T12:00:00.000Z", href: `${base}/chores` });
  });

  it("only shows dates from two months back to four months ahead", async () => {
    const { alex, apt } = await household();
    await prisma.chore.create({ data: { apartmentId: apt.id, title: "Old chore", assignedUserId: alex.user.id, dueDate: day("2026-11-01") } });
    await prisma.chore.create({ data: { apartmentId: apt.id, title: "Far chore", assignedUserId: alex.user.id, dueDate: day("2027-09-01") } });
    const titles = (await generatedEntries(apt.id, NOW)).map(e => e.title);
    expect(titles.some(t => t.startsWith("Chore: Old chore"))).toBe(false);
    expect(titles.some(t => t.startsWith("Chore: Far chore"))).toBe(false);
  });
});

describe("GET /calendar", () => {
  it("returns household events once, plus the generated entries, which can't be deleted", async () => {
    const { alex, apt } = await household();
    await prisma.calendarEvent.create({ data: { apartmentId: apt.id, userId: alex.user.id, title: "Repair: Leaking faucet", type: "MAINTENANCE", startDate: new Date(), allDay: false } });
    const list = await (await calendarRoute(request("/x", { token: alex.token }), routeParams({ id: apt.id }))).json();
    expect(list.filter((e: { title: string }) => e.title === "Repair: Leaking faucet")).toEqual([expect.objectContaining({ auto: false })]);
    const generated = list.filter((e: { auto: boolean }) => e.auto);
    expect(generated.length).toBeGreaterThan(0); // at least whose turn it is to shop
    expect((await deleteEventRoute(request("/x", { method: "DELETE", token: alex.token }), routeParams({ id: apt.id, eventId: generated[0].id }))).status).toBe(404);
  });
});
