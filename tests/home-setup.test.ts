/**
 * Sprint 11b: Home Setup (PRODUCT_LOGIC §4, MARKETPLACE_FLOW.md §22–24).
 * Create a Home with a move-in date, preview and ask to join with an invite
 * code, follow the request, and the move-in date in action (owner's decision
 * 2026-10-16: until then like being away; rent counts people moved in by the
 * month's due day). Also the street address of a listing stays private.
 */
import { describe, it, expect } from "vitest";
import { POST as createHome } from "@/app/api/apartments/route";
import { GET as previewJoin, POST as askToJoin } from "@/app/api/apartments/join/route";
import { GET as myRequests } from "@/app/api/apartments/join/requests/route";
import { POST as rejectRequest } from "@/app/api/apartments/[id]/join-requests/[memberId]/reject/route";
import { POST as createRotation } from "@/app/api/apartments/[id]/cleaning/route";
import { GET as browseListings } from "@/app/api/listings/route";
import { GET as getListing } from "@/app/api/listings/[id]/route";
import { awaySpans, movedInBy, notMovedInSpan } from "@/lib/away";
import { isAwayOn } from "@/lib/rotation";
import { startRentMonth } from "@/lib/rent";
import { defaultSplit } from "@/lib/expenses";
import { shoppingTurn } from "@/lib/shopping";
import { generatedEntries } from "@/lib/calendarFeed";
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { createUser, createApartment, request, routeParams } from "./helpers";

const at = (iso: string) => new Date(iso);
const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const sentEmails = () => (globalThis as unknown as { sentEmails: { to: string; subject: string; html: string }[] }).sentEmails;

/** A home whose admin lives there, plus `newcomer` (active) moving in on `moveIn`. */
async function homeWithNewcomer(moveIn: Date) {
  const admin = await createUser();
  const newcomer = await createUser();
  const apt = await createApartment(admin.user.id);
  await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: newcomer.user.id, joinedAt: new Date(Date.now() + 1000), moveInDate: moveIn } });
  return { admin, newcomer, apt };
}

describe("Create a Home", () => {
  const create = (token: string, body: unknown) => createHome(request("/api/apartments", { method: "POST", token, body }));

  it("makes the creator its household admin, with their move-in date", async () => {
    const me = await createUser();
    const res = await create(me.token, { name: "Prospect House", address: "123 Prospect Ave, Brooklyn", moveInDate: "2027-11-01" });
    expect(res.status).toBe(201);
    const home = await res.json();
    const member = await prisma.apartmentMember.findFirstOrThrow({ where: { apartmentId: home.id, userId: me.user.id } });
    expect(member).toMatchObject({ role: "ADMIN", status: "ACTIVE" });
    expect(member.moveInDate).toEqual(at("2027-11-01T00:00:00Z"));
  });

  it("needs a name and an address; the move-in date is optional but must be a date", async () => {
    const me = await createUser();
    expect((await create(me.token, { name: "", address: "x" })).status).toBe(400);
    expect((await create(me.token, { name: "Home", address: "x", moveInDate: "next week" })).status).toBe(400);
    const res = await create(me.token, { name: "Home", address: "x" });
    expect(res.status).toBe(201);
    const member = await prisma.apartmentMember.findFirstOrThrow({ where: { apartmentId: (await res.json()).id } });
    expect(member.moveInDate).toBeNull(); // living there already
  });
});

/** A home with a real-looking invite code (codes are upper case; what people type is upper-cased). */
async function homeWithCode(adminId: string) {
  const apt = await createApartment(adminId);
  return prisma.apartment.update({ where: { id: apt.id }, data: { inviteCode: randomUUID().slice(0, 8).toUpperCase() } });
}

describe("Join a Home", () => {
  const preview = (token: string | undefined, code: string) => previewJoin(request(`/api/apartments/join?code=${encodeURIComponent(code)}`, { token }));
  const ask = (token: string, body: unknown) => askToJoin(request("/api/apartments/join", { method: "POST", token, body }));

  it("previews the home from its code: name, address and how many live there", async () => {
    const admin = await createUser();
    const apt = await homeWithCode(admin.user.id);
    await prisma.apartment.update({ where: { id: apt.id }, data: { address: "123 Prospect Ave" } });
    const me = await createUser();

    expect((await preview(undefined, apt.inviteCode)).status).toBe(401);
    expect((await preview(me.token, "NOPE00")).status).toBe(404);
    const res = await preview(me.token, apt.inviteCode.toLowerCase());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "Test Apartment", address: "123 Prospect Ave", members: 1, myStatus: null, apartmentId: null });
  });

  it("asks to join with a move-in date: waiting for the admin, and the preview says so", async () => {
    const admin = await createUser();
    const apt = await homeWithCode(admin.user.id);
    const me = await createUser();

    const res = await ask(me.token, { inviteCode: apt.inviteCode, moveInDate: "2027-03-01" });
    expect(res.status).toBe(201);
    const member = await prisma.apartmentMember.findFirstOrThrow({ where: { apartmentId: apt.id, userId: me.user.id } });
    expect(member).toMatchObject({ status: "PENDING_APPROVAL", role: "MEMBER" });
    expect(member.moveInDate).toEqual(at("2027-03-01T00:00:00Z"));
    expect((await (await preview(me.token, apt.inviteCode)).json()).myStatus).toBe("PENDING_APPROVAL");
    expect((await ask(me.token, { inviteCode: apt.inviteCode })).status).toBe(409);
  });

  it("limits tries, so codes can't be guessed", async () => {
    const me = await createUser();
    for (let i = 0; i < 20; i++) expect((await preview(me.token, `ZZ${i}`)).status).toBe(404);
    expect((await preview(me.token, "ZZ99")).status).toBe(429);
  });

  it("Join status lists my requests waiting for an answer, and nobody else's", async () => {
    const admin = await createUser();
    const apt = await homeWithCode(admin.user.id);
    await prisma.apartment.update({ where: { id: apt.id }, data: { name: "Prospect House", address: "123 Prospect Ave" } });
    const me = await createUser();
    const other = await createUser();
    await ask(me.token, { inviteCode: apt.inviteCode, moveInDate: "2027-03-01" });
    await ask(other.token, { inviteCode: apt.inviteCode });

    expect((await myRequests(request("/api/apartments/join/requests"))).status).toBe(401);
    const list = await (await myRequests(request("/api/apartments/join/requests", { token: me.token }))).json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ homeName: "Prospect House", homeAddress: "123 Prospect Ave", role: "MEMBER" });
  });

  it("a refused request is gone, and the person hears about it by email", async () => {
    const admin = await createUser();
    const apt = await homeWithCode(admin.user.id);
    const me = await createUser();
    await ask(me.token, { inviteCode: apt.inviteCode });
    const pending = await prisma.apartmentMember.findFirstOrThrow({ where: { apartmentId: apt.id, userId: me.user.id } });

    const res = await rejectRequest(
      request(`/api/apartments/${apt.id}/join-requests/${pending.id}/reject`, { method: "POST", token: admin.token }),
      routeParams({ id: apt.id, memberId: pending.id }),
    );
    expect(res.status).toBe(200);
    expect(await prisma.apartmentMember.findUnique({ where: { id: pending.id } })).toBeNull();
    expect(sentEmails().some(m => m.to === me.user.email && m.subject === "Your request to join Test Apartment")).toBe(true);
  });
});

describe("the move-in date in action", () => {
  it("until the move-in day someone counts like a person away; from that day on, they're home", () => {
    const span = notMovedInSpan("u1", at("2027-03-10T00:00:00Z"));
    expect(isAwayOn([span], "u1", at("2027-03-09T23:00:00Z"))).toBe(true);
    expect(isAwayOn([span], "u1", at("2027-03-10T00:00:00Z"))).toBe(false);
    expect(movedInBy(null, at("2027-03-01T00:00:00Z"))).toBe(true);
    expect(movedInBy(at("2027-03-23T00:00:00Z"), at("2027-03-23T00:00:00Z"))).toBe(true); // on the due day itself
    expect(movedInBy(at("2027-03-24T00:00:00Z"), at("2027-03-23T00:00:00Z"))).toBe(false);
  });

  it("rent: a month counts the people who moved in by its due day", async () => {
    const payer = await createUser();
    const early = await createUser();
    const late = await createUser();
    const apt = await createApartment(payer.user.id);
    await prisma.apartmentMember.createMany({ data: [
      { apartmentId: apt.id, userId: early.user.id, moveInDate: at("2027-03-23T00:00:00Z") },
      { apartmentId: apt.id, userId: late.user.id, moveInDate: at("2027-03-24T00:00:00Z") },
    ] });
    await prisma.rentConfig.create({ data: { apartmentId: apt.id, totalAmount: 1200, dueDay: 23, rentPayerId: payer.user.id } });

    const { cycle } = await startRentMonth(apt.id, "2027-03");
    const shares = await prisma.rentPayment.findMany({ where: { rentCycleId: cycle.id } });
    expect(shares.map(s => [s.userId, s.amount])).toEqual([[early.user.id, 600]]); // the payer and early split it; late isn't in yet

    const { cycle: april } = await startRentMonth(apt.id, "2027-04");
    expect(await prisma.rentPayment.count({ where: { rentCycleId: april.id } })).toBe(2); // both roommates now
  });

  it("shared expenses: left out of the default split until they move in", async () => {
    const { admin, newcomer, apt } = await homeWithNewcomer(at("2027-03-10T00:00:00Z"));
    expect(await defaultSplit(apt.id, admin.user.id, at("2027-03-09T12:00:00Z"))).toEqual([admin.user.id]);
    expect(await defaultSplit(apt.id, admin.user.id, at("2027-03-10T12:00:00Z"))).toEqual([admin.user.id, newcomer.user.id]);
  });

  it("shopping: someone not moved in never holds the turn", async () => {
    const newcomer = await createUser();
    const admin = await createUser();
    const apt = await prisma.apartment.create({ data: { name: "Test Apartment", inviteCode: randomUUID().slice(0, 8) } });
    // The newcomer joined first, so the order starts with them.
    await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: newcomer.user.id, role: "ADMIN", moveInDate: at("2027-03-10T00:00:00Z") } });
    await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: admin.user.id, joinedAt: new Date(Date.now() + 1000) } });

    const before = await shoppingTurn(apt.id, { now: at("2027-03-09T12:00:00Z") });
    expect(before.order).toEqual([newcomer.user.id, admin.user.id]);
    expect(before.shopperId).toBe(admin.user.id);
    expect((await shoppingTurn(apt.id, { now: at("2027-03-10T12:00:00Z") })).shopperId).toBe(newcomer.user.id);
  });

  it("cleaning: a new rotation starts with someone who has moved in, and the calendar skips the newcomer until then", async () => {
    const { admin, newcomer, apt } = await homeWithNewcomer(new Date(Date.now() + 14 * DAY));
    await prisma.user.update({ where: { id: admin.user.id }, data: { name: "Admin" } });
    await prisma.user.update({ where: { id: newcomer.user.id }, data: { name: "Newcomer" } });
    const res = await createRotation(
      request(`/api/apartments/${apt.id}/cleaning`, { method: "POST", token: admin.token, body: { frequency: "WEEKLY", memberIds: [newcomer.user.id, admin.user.id] } }),
      routeParams({ id: apt.id }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).currentIndex).toBe(1);

    const spans = await awaySpans(apt.id);
    expect(isAwayOn(spans, newcomer.user.id, new Date())).toBe(true);
    const entries = await generatedEntries(apt.id);
    const turns = entries.filter(e => e.id.startsWith("auto:cleaning:")).map(e => ({ title: e.title, day: e.startDate.slice(0, 10) }));
    const moveInDay = ymd(new Date(Date.now() + 14 * DAY));
    const beforeMoveIn = turns.filter(t => t.day < moveInDay);
    expect(beforeMoveIn.length).toBeGreaterThan(0);
    expect(beforeMoveIn.every(t => t.title === "Cleaning: Admin")).toBe(true);
    expect(entries.find(e => e.id === `auto:move-in:${newcomer.user.id}`)).toMatchObject({ title: "Newcomer moves in", startDate: `${moveInDay}T12:00:00.000Z` });
  });
});

describe("a listing's street address stays private", () => {
  async function listingWithAddress() {
    const owner = await createUser();
    const city = `City-${randomUUID()}`;
    const listing = await prisma.listing.create({
      data: { type: "APARTMENT_FOR_RENT", status: "APPROVED", title: "t", description: "d", price: 1000, city, address: "1234 Myrtle Ave", ownerId: owner.user.id },
    });
    return { owner, listing, city };
  }

  it("not in search results, nor on the listing page for visitors and other people", async () => {
    const { listing, city } = await listingWithAddress();
    const results = await (await browseListings(request(`/api/listings?city=${city}`))).json();
    expect(results).toHaveLength(1);
    expect(results[0]).not.toHaveProperty("address");
    expect(results[0]).not.toHaveProperty("rejectionReason");

    const visitor = await (await getListing(request(`/api/listings/${listing.id}`), routeParams({ id: listing.id }))).json();
    expect(visitor.city).toBe(city);
    expect(visitor).not.toHaveProperty("address");
    const someone = await createUser();
    const other = await (await getListing(request(`/api/listings/${listing.id}`, { token: someone.token }), routeParams({ id: listing.id }))).json();
    expect(other).not.toHaveProperty("address");
  });

  it("the poster and platform admins still see it", async () => {
    const { owner, listing } = await listingWithAddress();
    const mine = await (await getListing(request(`/api/listings/${listing.id}`, { token: owner.token }), routeParams({ id: listing.id }))).json();
    expect(mine.address).toBe("1234 Myrtle Ave");
    const admin = await createUser({ systemRole: "SUPER_ADMIN" });
    const reviewed = await (await getListing(request(`/api/listings/${listing.id}`, { token: admin.token }), routeParams({ id: listing.id }))).json();
    expect(reviewed.address).toBe("1234 Myrtle Ave");
  });
});
