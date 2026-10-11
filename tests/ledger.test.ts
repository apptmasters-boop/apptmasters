/**
 * Sprint 5a: the Money ledger (PRODUCT_LOGIC §11.2) and the check that it
 * agrees with today's Money page before anything switches over.
 */
import { describe, it, expect } from "vitest";
import { ledgerEntries, netDebts, fundBalance, compareDebts, compareWithCurrent } from "@/lib/ledger";
import { householdDebts } from "@/lib/balances";
import { GET as moneyCheck } from "@/app/api/admin/money-check/route";
import { GET as getLedger } from "@/app/api/apartments/[id]/ledger/route";
import { position, net, unpaidRent, toConfirm } from "@/lib/moneySummary";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

/** Alex (admin, rent payer), Sam and Kim. */
async function household() {
  const alex = await createUser();
  const sam = await createUser();
  const kim = await createUser();
  const apt = await createApartment(alex.user.id);
  await prisma.apartmentMember.createMany({ data: [{ apartmentId: apt.id, userId: sam.user.id }, { apartmentId: apt.id, userId: kim.user.id }] });
  return { alex, sam, kim, apt, ids: { alex: alex.user.id, sam: sam.user.id, kim: kim.user.id } };
}

/** An expense paid by `paidBy`, split equally between `between`, with optional split statuses. */
async function expense(apartmentId: string, paidById: string, amount: number, between: string[], opts: { status?: string; splitStatus?: Record<string, string> } = {}) {
  const share = Math.round((amount / between.length) * 100) / 100;
  return prisma.expense.create({
    data: {
      apartmentId, paidById, title: "Groceries", amount, status: opts.status ?? "ACTIVE",
      splits: { create: between.map(userId => ({ userId, amount: share, status: opts.splitStatus?.[userId] ?? "PENDING" })) },
    },
  });
}

async function rentMonth(apartmentId: string, rentPayerId: string, month: string, shares: Record<string, { amount: number; status?: string }>) {
  return prisma.rentCycle.create({
    data: {
      apartmentId, rentPayerId, month, totalAmount: 1950,
      payments: { create: Object.entries(shares).map(([userId, s]) => ({ userId, amount: s.amount, status: s.status ?? "PENDING" })) },
    },
  });
}

const owed = (debts: { from: string; to: string; amount: number }[], from: string, to: string) =>
  debts.find(d => d.from === from && d.to === to)?.amount ?? 0;

describe("ledger entries and balances", () => {
  it("expense shares: everyone but the payer owes their share; paid shares don't count", async () => {
    const { apt, ids } = await household();
    await expense(apt.id, ids.alex, 60, [ids.alex, ids.sam, ids.kim], { splitStatus: { [ids.kim]: "PAID" } });
    const debts = netDebts(await ledgerEntries(apt.id));
    expect(owed(debts, ids.sam, ids.alex)).toBe(20);
    expect(owed(debts, ids.kim, ids.alex)).toBe(0);
  });

  it("a cash payment waiting for confirmation is listed but still owed", async () => {
    const { apt, ids } = await household();
    await expense(apt.id, ids.alex, 40, [ids.alex, ids.sam], { splitStatus: { [ids.sam]: "PENDING_CASH" } });
    const entries = await ledgerEntries(apt.id);
    expect(entries.find(e => e.pending)?.kind).toBe("PAYMENT");
    expect(owed(netDebts(entries), ids.sam, ids.alex)).toBe(20);
  });

  it("an expense marked settled by hand counts as paid", async () => {
    const { apt, ids } = await household();
    await expense(apt.id, ids.alex, 40, [ids.alex, ids.sam], { status: "SETTLED" });
    expect(netDebts(await ledgerEntries(apt.id))).toEqual([]);
  });

  it("nets debts both ways between two people", async () => {
    const { apt, ids } = await household();
    await expense(apt.id, ids.alex, 50, [ids.alex, ids.sam]); // Sam owes Alex 25
    await expense(apt.id, ids.sam, 30, [ids.alex, ids.sam]);  // Alex owes Sam 15
    const debts = netDebts(await ledgerEntries(apt.id));
    expect(debts).toEqual([{ from: ids.sam, to: ids.alex, amount: 10 }]);
  });

  it("rent: each month's share is owed to the rent payer until the rent payer confirms it", async () => {
    const { apt, ids } = await household();
    // The blueprint's example (§12.2): two months unpaid = $1,300 owed, not $0.
    await rentMonth(apt.id, ids.alex, "2026-09", { [ids.sam]: { amount: 650 }, [ids.kim]: { amount: 650, status: "CONFIRMED" } });
    await rentMonth(apt.id, ids.alex, "2026-10", { [ids.sam]: { amount: 650, status: "PAID" }, [ids.kim]: { amount: 650, status: "CONFIRMED" } });
    const entries = await ledgerEntries(apt.id);
    const debts = netDebts(entries);
    expect(owed(debts, ids.sam, ids.alex)).toBe(1300); // October was marked paid but isn't confirmed yet
    expect(owed(debts, ids.kim, ids.alex)).toBe(0);
    expect(entries.find(e => e.id.startsWith("rent-share:"))?.label).toBe("Rent September 2026");
  });

  it("the shared fund is its own balance, not a debt between people", async () => {
    const { apt, ids } = await household();
    const fund = await prisma.apartmentFund.create({ data: { apartmentId: apt.id, balance: 70 } });
    await prisma.fundTransaction.createMany({ data: [
      { fundId: fund.id, apartmentId: apt.id, userId: ids.sam, type: "CONTRIBUTION", amount: 100, description: "Top up" },
      { fundId: fund.id, apartmentId: apt.id, userId: ids.kim, type: "WITHDRAWAL", amount: 30, description: "Soap" },
    ] });
    const entries = await ledgerEntries(apt.id);
    expect(fundBalance(entries)).toBe(70);
    expect(netDebts(entries)).toEqual([]);
    expect((await compareWithCurrent(apt.id)).fund.matches).toBe(true);
  });

  it("amounts are added in cents, so thirds don't drift", async () => {
    const { apt, ids } = await household();
    for (let i = 0; i < 9; i++) await expense(apt.id, ids.alex, 10, [ids.alex, ids.sam, ids.kim]); // 3.33 each
    expect(owed(netDebts(await ledgerEntries(apt.id)), ids.sam, ids.alex)).toBe(29.97);
  });
});

describe("comparison with today's Money page", () => {
  it("gives the same shared-expense balances as today's calculation", async () => {
    const { apt, ids } = await household();
    await expense(apt.id, ids.alex, 90, [ids.alex, ids.sam, ids.kim], { splitStatus: { [ids.kim]: "PAID" } });
    await expense(apt.id, ids.sam, 40, [ids.alex, ids.sam], { splitStatus: { [ids.alex]: "PENDING_CASH" } });
    await expense(apt.id, ids.kim, 20, [ids.sam, ids.kim], { status: "SETTLED" });
    await expense(apt.id, ids.kim, 33.33, [ids.alex, ids.sam, ids.kim], { status: "DISPUTED" });
    await rentMonth(apt.id, ids.alex, "2026-10", { [ids.sam]: { amount: 650 } });

    const check = await compareWithCurrent(apt.id);
    expect(check.expensesMatch).toBe(true);
    expect(compareDebts(await householdDebts(apt.id), netDebts((await ledgerEntries(apt.id)).filter(e => e.source === "expense")))).toEqual([]);
    expect(owed(check.rentOwed, ids.sam, ids.alex)).toBe(650);
    // Everything together: expenses net to Sam owing Alex 10 (30 − 20), plus 650 rent.
    expect(owed(check.allDebts, ids.sam, ids.alex)).toBe(660);
  });

  it("reports a difference when the two disagree", () => {
    const diffs = compareDebts([{ from: "a", to: "b", amount: 10 }], [{ from: "a", to: "b", amount: 12.5 }]);
    expect(diffs).toEqual([{ from: "a", to: "b", current: 10, ledger: 12.5 }]);
    expect(compareDebts([{ from: "a", to: "b", amount: 10 }], [{ from: "a", to: "b", amount: 10 }])).toEqual([]);
  });
});

describe("Money check report and ledger API", () => {
  it("the report is for site admins only", async () => {
    const { alex } = await household(); // household admin, not a site admin
    expect((await moneyCheck(request("/api/admin/money-check", { token: alex.token }))).status).toBe(403);

    const admin = await createUser({ systemRole: "SUPER_ADMIN" });
    const res = await moneyCheck(request("/api/admin/money-check", { token: admin.token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.households)).toBe(true);
  });

  it("lists a household's rent owed with names", async () => {
    const { apt, ids, sam, alex } = await household();
    await rentMonth(apt.id, ids.alex, "2026-10", { [ids.sam]: { amount: 650 } });
    const admin = await createUser({ systemRole: "SUPER_ADMIN" });
    const body = await (await moneyCheck(request("/api/admin/money-check", { token: admin.token }))).json();
    const mine = body.households.find((h: { id: string }) => h.id === apt.id);
    expect(mine.expensesMatch).toBe(true);
    expect(mine.rentOwed).toEqual([expect.objectContaining({ fromName: sam.user.name, toName: alex.user.name, amount: 650 })]);
  });

  it("members can read their household's ledger; others can't", async () => {
    const { apt, ids, sam } = await household();
    await expense(apt.id, ids.alex, 40, [ids.alex, ids.sam]);
    const res = await getLedger(request("/x", { token: sam.token }), routeParams({ id: apt.id }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.debts).toEqual([{ from: ids.sam, to: ids.alex, amount: 20 }]);
    expect(body.entries[0]).toMatchObject({ kind: "EXPENSE_SHARE", amount: 20 });

    const outsider = await createUser();
    expect((await getLedger(request("/x", { token: outsider.token }), routeParams({ id: apt.id }))).status).toBe(403);
  });
});

describe("Sprint 5b: the Money tab's numbers", () => {
  it("rent and expenses add up for Overview, split by source, and never 'settled' while rent is owed", async () => {
    const { apt, ids, sam } = await household();
    await expense(apt.id, ids.sam, 40, [ids.alex, ids.sam]);          // Alex owes Sam 20
    await rentMonth(apt.id, ids.alex, "2026-10", { [ids.sam]: { amount: 650 } }); // Sam owes Alex 650
    const body = await (await getLedger(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).json();

    expect(body.me).toBe(ids.sam);
    expect(position(body.debts, ids.sam)).toEqual({ owe: 630, owed: 0 }); // netted with Alex
    expect(net(body.bySource.rent, ids.sam)).toBe(650);
    expect(net(body.bySource.expense, ids.sam)).toBe(-20);
    expect(body.names[ids.alex]).toBeTruthy();
  });

  it("lists my unpaid rent, earliest first, and marks what's waiting for confirmation", async () => {
    const { apt, ids, sam } = await household();
    await rentMonth(apt.id, ids.alex, "2026-10", { [ids.sam]: { amount: 650, status: "PAID" } });
    await rentMonth(apt.id, ids.alex, "2026-09", { [ids.sam]: { amount: 650 } });
    await rentMonth(apt.id, ids.alex, "2026-08", { [ids.sam]: { amount: 650, status: "CONFIRMED" } });
    const body = await (await getLedger(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).json();

    const rent = unpaidRent(body.entries, ids.sam);
    expect(rent.map(r => [r.label, r.waiting])).toEqual([["Rent September 2026", false], ["Rent October 2026", true]]);
    expect(toConfirm(body.entries, ids.alex).map(p => p.amount)).toEqual([650]); // Alex has Sam's October to confirm
    expect(toConfirm(body.entries, ids.sam)).toEqual([]);
  });

  it("shows people who moved out as such", async () => {
    const { apt, ids, sam } = await household();
    await expense(apt.id, ids.kim, 30, [ids.sam, ids.kim]);
    await prisma.apartmentMember.updateMany({ where: { apartmentId: apt.id, userId: ids.kim }, data: { status: "MOVED_OUT" } });
    const body = await (await getLedger(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).json();
    expect(body.names[ids.kim].endsWith("(moved out)")).toBe(true);
  });
});
