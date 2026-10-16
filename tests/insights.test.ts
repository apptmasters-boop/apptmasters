/**
 * Sprint 10b: Insights (PRODUCT_LOGIC §19) aggregate the same sources as the
 * rest of the app: expenses for spending, the rent summaries, the Money
 * ledger for who owes whom, and the household records. Dates are fixed (2027).
 */
import { describe, it, expect } from "vitest";
import { GET as insightsRoute } from "@/app/api/apartments/[id]/insights/route";
import { householdInsights } from "@/lib/insights";
import { ledgerEntries, netDebts } from "@/lib/ledger";
import { startRentMonth } from "@/lib/rent";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const NOW = new Date("2027-03-20T12:00:00Z");
const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** Alex (admin), Sam and Kim, with expenses in February and March 2027 and one too old to count. */
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
  const ids = { alex: alex.user.id, sam: sam.user.id, kim: kim.user.id };
  const expense = (paidById: string, amount: number, category: string, date: string, splits: Record<string, number>) =>
    prisma.expense.create({ data: { apartmentId: apt.id, paidById, title: category, amount, category, date: day(date), splits: { create: Object.entries(splits).map(([userId, a]) => ({ userId, amount: a })) } } });
  await expense(ids.alex, 90, "GROCERIES", "2027-03-05", { [ids.alex]: 0, [ids.sam]: 30, [ids.kim]: 30 });
  await expense(ids.sam, 40, "UTILITIES", "2027-03-10", { [ids.alex]: 20, [ids.sam]: 0 });
  await expense(ids.kim, 30, "GENERAL", "2027-02-15", { [ids.alex]: 10, [ids.sam]: 10, [ids.kim]: 0 });
  await expense(ids.alex, 500, "GENERAL", "2026-08-01", { [ids.alex]: 0, [ids.sam]: 250 }); // older than 6 months
  return { alex, sam, kim, apt, ids };
}

describe("Insights", () => {
  it("spending by month and category, and your share, over the last 6 months", async () => {
    const { apt, ids } = await household();
    const r = await householdInsights(apt.id, ids.alex, NOW);
    expect(r.months.map(m => m.month)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
    expect(r.months.at(-1)).toMatchObject({ total: 130, mine: 50 }); // Alex: his 30 of the groceries he paid, plus 20
    expect(r.months.at(-2)).toMatchObject({ total: 30, mine: 10 });
    expect(r.categories).toEqual([{ category: "GROCERIES", total: 90 }, { category: "UTILITIES", total: 40 }, { category: "GENERAL", total: 30 }]);
    expect(r.totals).toEqual({ sixMonths: 160, thisMonth: 130, mineThisMonth: 50 });
  });

  it("everyone's shares add up to the household's spending", async () => {
    const { apt, ids } = await household();
    const r = await householdInsights(apt.id, ids.alex, NOW);
    const by = Object.fromEntries(r.people.map(p => [p.userId, p]));
    expect([by[ids.alex].paid, by[ids.alex].share]).toEqual([90, 60]);
    expect([by[ids.sam].paid, by[ids.sam].share]).toEqual([40, 60]);
    expect([by[ids.kim].paid, by[ids.kim].share]).toEqual([30, 40]);
    expect(r.people.reduce((s, p) => s + p.share, 0)).toBe(r.totals.sixMonths);
  });

  it("rent and who owes whom are the same numbers as Money", async () => {
    const { apt, ids } = await household();
    await prisma.rentConfig.create({ data: { apartmentId: apt.id, totalAmount: 1200, dueDay: 5, rentPayerId: ids.alex } });
    await startRentMonth(apt.id, "2027-03");
    const r = await householdInsights(apt.id, ids.alex, NOW);
    expect(r.rent).toEqual([expect.objectContaining({ month: "2027-03", expected: 800, collected: 0, stillToCollect: 800, landlordPaid: false })]);
    const ledger = netDebts(await ledgerEntries(apt.id));
    expect(r.debts.map(d => ({ from: d.from, to: d.to, amount: d.amount }))).toEqual(ledger);
  });

  it("who does what over the last 3 months: cleanings, shopping trips, chores", async () => {
    const { apt, ids } = await household();
    const rotation = await prisma.cleaningRotation.create({ data: { apartmentId: apt.id, name: "Cleaning", memberOrder: JSON.stringify([ids.sam]), nextDue: day("2027-03-27") } });
    await prisma.cleaningLog.create({ data: { apartmentId: apt.id, rotationId: rotation.id, cleanedById: ids.sam, cleanedAt: day("2027-03-01") } });
    await prisma.cleaningLog.create({ data: { apartmentId: apt.id, rotationId: rotation.id, cleanedById: ids.sam, cleanedAt: day("2026-11-01") } }); // older than 3 months
    await prisma.shoppingTrip.create({ data: { apartmentId: apt.id, shopperId: ids.kim, status: "COMPLETED", totalAmount: 45.5, endedAt: day("2027-03-12") } });
    await prisma.chore.create({ data: { apartmentId: apt.id, title: "Trash", status: "DONE", completedById: ids.alex, completedAt: day("2027-03-02") } });
    await prisma.chore.create({ data: { apartmentId: apt.id, title: "Plants", status: "PENDING", assignedUserId: ids.kim, dueDate: day("2027-03-15") } });

    const r = await householdInsights(apt.id, ids.alex, NOW);
    const by = Object.fromEntries(r.people.map(p => [p.userId, p]));
    expect(by[ids.sam].cleanings).toBe(1);
    expect([by[ids.kim].trips, by[ids.kim].tripsTotal]).toEqual([1, 45.5]);
    expect(by[ids.alex].choresDone).toBe(1);
    expect([by[ids.kim].choresToDo, by[ids.kim].choresOverdue]).toEqual([1, 1]);
  });

  it("is for members of the household", async () => {
    const { apt, sam } = await household();
    expect((await insightsRoute(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).status).toBe(200);
    const outsider = await createUser();
    expect((await insightsRoute(request("/x", { token: outsider.token }), routeParams({ id: apt.id }))).status).toBe(403);
  });
});
