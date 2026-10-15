/**
 * Sprint 6: Shopping → Money (PRODUCT_LOGIC §10.7, §10.8). Leaving the store
 * turns the trip's total into the grocery expense, split as chosen at checkout.
 */
import { describe, it, expect } from "vitest";
import { GET as getShopping } from "@/app/api/apartments/[id]/shopping/route";
import { POST as tripStep } from "@/app/api/apartments/[id]/shopping/trip/route";
import { POST as addExpense } from "@/app/api/apartments/[id]/expenses/route";
import { buildHomeFeed } from "@/lib/homeFeed";
import { compareWithCurrent, ledgerEntries, netDebts } from "@/lib/ledger";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const RECEIPT = "/uploads/receipts/0b5f8d3e-1c2a-4c55-9d7e-2f6a1b3c4d5e.jpg";

/** Alex (shopper, joined first), Sam and Kim share costs; a guest doesn't. */
async function household() {
  const alex = await createUser();
  const sam = await createUser();
  const kim = await createUser();
  const guest = await createUser();
  const apt = await createApartment(alex.user.id);
  const t = Date.now();
  await prisma.apartmentMember.createMany({ data: [
    { apartmentId: apt.id, userId: sam.user.id, joinedAt: new Date(t + 1000) },
    { apartmentId: apt.id, userId: kim.user.id, joinedAt: new Date(t + 2000) },
    { apartmentId: apt.id, userId: guest.user.id, role: "GUEST", joinedAt: new Date(t + 3000) },
  ] });
  return { alex, sam, kim, guest, apt };
}
const step = (token: string, aptId: string, action: string, extra: object = {}) =>
  tripStep(request("/x", { method: "POST", token, body: { action, ...extra } }), routeParams({ id: aptId }));
/** Start → skip inventory → at the store → checkout with `extra`. */
async function toCheckout(token: string, aptId: string, extra: object) {
  for (const a of ["start", "skip_inventory", "at_store"]) await step(token, aptId, a);
  return step(token, aptId, "checkout", { total: 30, receiptUrl: RECEIPT, ...extra });
}
const owedTo = async (aptId: string, from: string, to: string) =>
  netDebts(await ledgerEntries(aptId)).find(d => d.from === from && d.to === to)?.amount ?? 0;

describe("Sprint 6: the trip becomes the grocery expense", () => {
  it("leaving the store creates one grocery expense: shopper paid, receipt attached, shared by everyone but guests", async () => {
    const { alex, sam, kim, guest, apt } = await household();
    expect((await toCheckout(alex.token, apt.id, {})).status).toBe(200); // no choice sent: everyone not away
    expect(await prisma.expense.count({ where: { apartmentId: apt.id } })).toBe(0); // not before leaving

    expect((await step(alex.token, apt.id, "left_store")).status).toBe(200);
    const expense = await prisma.expense.findFirstOrThrow({ where: { apartmentId: apt.id }, include: { splits: true, shoppingTrip: true } });
    expect(expense).toMatchObject({ title: "Groceries", category: "GROCERIES", amount: 30, paidById: alex.user.id, receiptUrl: RECEIPT });
    expect(expense.shoppingTrip?.status).toBe("COMPLETED");
    const shares = Object.fromEntries(expense.splits.map(s => [s.userId, s.amount]));
    expect(shares).toEqual({ [alex.user.id]: 0, [sam.user.id]: 10, [kim.user.id]: 10 });
    expect(shares[guest.user.id]).toBeUndefined();

    const note = await prisma.notification.findFirst({ where: { userId: sam.user.id, type: "EXPENSE_ADDED" } });
    expect(note?.title).toMatch(/finished shopping: your share is \$10\.00$/);
    expect(await owedTo(apt.id, sam.user.id, alex.user.id)).toBe(10);
  });

  it("people unticked at review aren't charged, and the share grows for the others", async () => {
    const { alex, sam, kim, apt } = await household();
    await toCheckout(alex.token, apt.id, { splitWith: [alex.user.id, sam.user.id] });
    await step(alex.token, apt.id, "left_store");
    expect(await owedTo(apt.id, sam.user.id, alex.user.id)).toBe(15);
    expect(await owedTo(apt.id, kim.user.id, alex.user.id)).toBe(0);
    expect(await prisma.notification.count({ where: { userId: kim.user.id, type: "EXPENSE_ADDED" } })).toBe(0);
  });

  it("people away start unticked, and the page lists them as away", async () => {
    const { alex, sam, kim, apt } = await household();
    await prisma.travelPeriod.create({ data: { apartmentId: apt.id, userId: kim.user.id, startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000) } });
    const state = await (await getShopping(request("/x", { token: alex.token }), routeParams({ id: apt.id }))).json();
    expect(state.splitOptions.find((p: { id: string }) => p.id === kim.user.id).away).toBe(true);

    await toCheckout(alex.token, apt.id, {});
    await step(alex.token, apt.id, "left_store");
    expect(await owedTo(apt.id, sam.user.id, alex.user.id)).toBe(15);
    expect(await owedTo(apt.id, kim.user.id, alex.user.id)).toBe(0);
  });

  it("the split must name people who share costs here", async () => {
    const { alex, guest, apt } = await household();
    const outsider = await createUser();
    expect((await toCheckout(alex.token, apt.id, { splitWith: [] })).status).toBe(400);
    expect((await step(alex.token, apt.id, "checkout", { total: 30, receiptUrl: RECEIPT, splitWith: [guest.user.id] })).status).toBe(400);
    expect((await step(alex.token, apt.id, "checkout", { total: 30, receiptUrl: RECEIPT, splitWith: [outsider.user.id] })).status).toBe(400);
  });

  it("Money, Home and the Money check all see it", async () => {
    const { alex, sam, apt } = await household();
    await toCheckout(alex.token, apt.id, {});
    await step(alex.token, apt.id, "left_store");
    expect((await compareWithCurrent(apt.id)).expensesMatch).toBe(true);
    expect((await buildHomeFeed(apt.id, sam.user.id, "MEMBER")).find(i => i.id === "money:owed")?.title).toBe("You owe $10.00");
    const state = await (await getShopping(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).json();
    expect(state.lastTrip).toMatchObject({ totalAmount: 30, splitCount: 3 });
  });

  it("Add Expense still splits the same way (shared rules)", async () => {
    const { alex, sam, kim, apt } = await household();
    await prisma.travelPeriod.create({ data: { apartmentId: apt.id, userId: kim.user.id, startDate: new Date(Date.now() - 86_400_000), endDate: null } });
    const res = await addExpense(request("/x", { method: "POST", token: alex.token, body: { title: "Soap", amount: 9 } }), routeParams({ id: apt.id }));
    expect(res.status).toBe(201);
    const shares = Object.fromEntries((await res.json()).splits.map((s: { userId: string; amount: number }) => [s.userId, s.amount]));
    expect(shares).toEqual({ [alex.user.id]: 0, [sam.user.id]: 4.5 }); // Kim is away
  });
});
