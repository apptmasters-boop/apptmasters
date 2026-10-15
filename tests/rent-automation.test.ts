/**
 * Sprint 7b: rent that runs by itself (PRODUCT_LOGIC §12, §22). Each month
 * starts 3 days before its due day, the household is told, reminders go out
 * on the due day and when late, and the rent payer can rotate. Dates are fixed
 * (2027) so the tests don't depend on today's date.
 */
import { describe, it, expect } from "vitest";
import { POST as cronRoute } from "@/app/api/cron/rent-reminder/route";
import { monthsComingDue, ensureRentMonths, runRentAutomation } from "@/lib/rent";
import { buildHomeFeed } from "@/lib/homeFeed";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request } from "./helpers";

const at = (iso: string) => new Date(iso);

/** Alex (admin, joined first) pays the landlord $1,200 due on `dueDay`; Sam and Kim owe $400 each. */
async function household(opts: { dueDay?: number; autoRotate?: boolean } = {}) {
  const alex = await createUser();
  const sam = await createUser();
  const kim = await createUser();
  const apt = await createApartment(alex.user.id);
  const t = Date.now();
  await prisma.apartmentMember.createMany({ data: [
    { apartmentId: apt.id, userId: sam.user.id, joinedAt: new Date(t + 1000) },
    { apartmentId: apt.id, userId: kim.user.id, joinedAt: new Date(t + 2000) },
  ] });
  await prisma.rentConfig.create({
    data: { apartmentId: apt.id, totalAmount: 1200, dueDay: opts.dueDay ?? 23, rentPayerId: alex.user.id, autoRotate: opts.autoRotate ?? false },
  });
  return { alex, sam, kim, apt };
}
const notes = (userId: string, apartmentId: string) =>
  prisma.notification.findMany({ where: { userId, apartmentId, type: "RENT_REMINDER" }, orderBy: { createdAt: "asc" } });

describe("which month is coming due", () => {
  it("from 3 days before its due day until a week after it", () => {
    expect(monthsComingDue(23, at("2027-03-19T23:00:00Z"))).toEqual([]);
    expect(monthsComingDue(23, at("2027-03-20T00:00:00Z"))).toEqual(["2027-03"]);
    expect(monthsComingDue(23, at("2027-03-30T23:00:00Z"))).toEqual(["2027-03"]);
    expect(monthsComingDue(23, at("2027-03-31T00:00:00Z"))).toEqual([]);
  });

  it("rent due on the 1st starts at the end of the month before", () => {
    expect(monthsComingDue(1, at("2027-03-29T09:00:00Z"))).toEqual(["2027-04"]);
    expect(monthsComingDue(1, at("2027-04-08T09:00:00Z"))).toEqual(["2027-04"]);
    expect(monthsComingDue(1, at("2027-04-09T09:00:00Z"))).toEqual([]);
  });

  it("rent due late in a month can still start early the next month", () => {
    expect(monthsComingDue(28, at("2027-04-02T09:00:00Z"))).toEqual(["2027-03"]);
  });
});

describe("a month starts by itself", () => {
  it("in its window, once, and the household is told", async () => {
    const { alex, sam, kim, apt } = await household();
    expect(await ensureRentMonths(apt.id, at("2027-03-19T12:00:00Z"))).toEqual([]);
    expect(await ensureRentMonths(apt.id, at("2027-03-20T09:00:00Z"))).toEqual(["2027-03"]);
    expect(await ensureRentMonths(apt.id, at("2027-03-21T09:00:00Z"))).toEqual([]); // only once

    const cycle = await prisma.rentCycle.findFirstOrThrow({ where: { apartmentId: apt.id }, include: { payments: true } });
    expect(cycle).toMatchObject({ month: "2027-03", rentPayerId: alex.user.id, markedPaidAt: null });
    expect(Object.fromEntries(cycle.payments.map(p => [p.userId, p.amount]))).toEqual({ [sam.user.id]: 400, [kim.user.id]: 400 });

    const [samNote] = await notes(sam.user.id, apt.id);
    expect(samNote.title).toBe("March's rent: your share is $400.00");
    expect(samNote.body).toContain("Due Mar 23.");
    expect((await notes(alex.user.id, apt.id))[0].title).toBe("March's rent has started");
  });

  it("never fills in a month whose window has passed", async () => {
    const { apt } = await household();
    expect(await ensureRentMonths(apt.id, at("2027-04-02T09:00:00Z"))).toEqual([]); // March was due 10 days ago
    expect(await prisma.rentCycle.count({ where: { apartmentId: apt.id } })).toBe(0);
  });

  it("rotates the rent payer when that's switched on, unless an admin picked someone since", async () => {
    const { alex, sam, kim, apt } = await household({ autoRotate: true });
    await ensureRentMonths(apt.id, at("2027-02-20T09:00:00Z")); // first month: Alex
    await ensureRentMonths(apt.id, at("2027-03-20T09:00:00Z")); // next: Sam
    const march = await prisma.rentCycle.findFirstOrThrow({ where: { apartmentId: apt.id, month: "2027-03" }, include: { payments: true } });
    expect(march.rentPayerId).toBe(sam.user.id);
    expect(march.payments.map(p => p.userId).sort()).toEqual([alex.user.id, kim.user.id].sort());
    expect((await prisma.rentConfig.findUniqueOrThrow({ where: { apartmentId: apt.id } })).rentPayerId).toBe(sam.user.id);

    await prisma.rentConfig.update({ where: { apartmentId: apt.id }, data: { rentPayerId: kim.user.id } }); // an admin's choice
    await ensureRentMonths(apt.id, at("2027-04-20T09:00:00Z"));
    expect((await prisma.rentCycle.findFirstOrThrow({ where: { apartmentId: apt.id, month: "2027-04" } })).rentPayerId).toBe(kim.user.id);
  });
});

describe("reminders by themselves", () => {
  it("on the due day: roommates who haven't paid, and the rent payer until the landlord is paid; once a day", async () => {
    const { alex, sam, kim, apt } = await household();
    await ensureRentMonths(apt.id, at("2027-03-20T09:00:00Z"));
    await prisma.rentPayment.updateMany({ where: { userId: sam.user.id, rentCycle: { apartmentId: apt.id } }, data: { status: "PAID" } }); // Sam says paid

    await runRentAutomation(at("2027-03-23T09:00:00Z"), [apt.id]);
    const titles = async (id: string) => (await notes(id, apt.id)).map(n => n.title);
    expect(await titles(kim.user.id)).toContain("Rent due today");
    expect(await titles(sam.user.id)).not.toContain("Rent due today");
    expect(await titles(alex.user.id)).toContain("Pay the landlord today");

    await runRentAutomation(at("2027-03-23T15:00:00Z"), [apt.id]); // the job running twice the same day
    expect((await titles(kim.user.id)).filter(t => t === "Rent due today")).toHaveLength(1);

    await runRentAutomation(at("2027-03-24T09:00:00Z"), [apt.id]); // not a reminder day
    await prisma.rentCycle.updateMany({ where: { apartmentId: apt.id }, data: { markedPaidAt: at("2027-03-24T10:00:00Z") } });
    await runRentAutomation(at("2027-03-26T09:00:00Z"), [apt.id]); // 3 days late
    const kimNotes = await notes(kim.user.id, apt.id);
    expect(kimNotes.map(n => n.title)).toEqual(["March's rent: your share is $400.00", "Rent due today", "Your rent share is late"]);
    expect(kimNotes[2].body).toContain("was due Mar 23, 3 days ago");
    expect(await titles(alex.user.id)).not.toContain("The landlord isn't marked paid yet"); // marked paid on the 24th
  });

  it("the daily job needs the cron secret", async () => {
    const run = (secret?: string) => cronRoute(request("/api/cron/rent-reminder", { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} }));
    expect((await run()).status).toBe(401);
    expect((await run("wrong")).status).toBe(401);
  });
});

describe("Home tells the rent payer to pay the landlord", () => {
  it("from when the month starts until the landlord is marked paid; only the rent payer sees it", async () => {
    const { alex, sam, apt } = await household();
    await ensureRentMonths(apt.id, at("2027-03-20T09:00:00Z"));
    const feed = async (userId: string) => buildHomeFeed(apt.id, userId, "ADMIN", at("2027-03-21T09:00:00Z"));
    const item = (await feed(alex.user.id)).find(i => i.id.startsWith("rent:landlord:"));
    expect(item).toMatchObject({ priority: 2, title: "Pay the landlord: March rent", overdue: false });
    expect((await feed(sam.user.id)).some(i => i.id.startsWith("rent:landlord:"))).toBe(false);

    await prisma.rentCycle.updateMany({ where: { apartmentId: apt.id }, data: { markedPaidAt: new Date() } });
    expect((await feed(alex.user.id)).some(i => i.id.startsWith("rent:landlord:"))).toBe(false);
  });
});
