/**
 * Sprint 5c: Record a payment (PRODUCT_LOGIC §13.2). One payment to a person
 * covers expense and rent shares; the receiver confirms; nothing is deleted.
 */
import { describe, it, expect } from "vitest";
import { GET as openItemsRoute, POST as recordRoute } from "@/app/api/apartments/[id]/payments/route";
import { POST as answerRoute } from "@/app/api/apartments/[id]/payments/[paymentId]/route";
import { GET as getLedger } from "@/app/api/apartments/[id]/ledger/route";
import { buildHomeFeed } from "@/lib/homeFeed";
import { compareWithCurrent, ledgerEntries, netDebts } from "@/lib/ledger";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

/** Sam owes Alex: a $40 grocery share and October's $650 rent. Alex owes Sam $15. */
async function household() {
  const alex = await createUser();
  const sam = await createUser();
  const apt = await createApartment(alex.user.id);
  await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: sam.user.id } });
  const groceries = await prisma.expense.create({
    data: { apartmentId: apt.id, paidById: alex.user.id, title: "Groceries", amount: 80, splits: { create: [{ userId: alex.user.id, amount: 40 }, { userId: sam.user.id, amount: 40 }] } },
    include: { splits: true },
  });
  const internet = await prisma.expense.create({
    data: { apartmentId: apt.id, paidById: sam.user.id, title: "Internet", amount: 30, splits: { create: [{ userId: alex.user.id, amount: 15 }, { userId: sam.user.id, amount: 15 }] } },
    include: { splits: true },
  });
  const cycle = await prisma.rentCycle.create({
    data: { apartmentId: apt.id, rentPayerId: alex.user.id, month: "2026-10", totalAmount: 1300, payments: { create: [{ userId: sam.user.id, amount: 650 }] } },
    include: { payments: true },
  });
  return {
    alex, sam, apt,
    samGrocery: groceries.splits.find(s => s.userId === sam.user.id)!,
    alexInternet: internet.splits.find(s => s.userId === alex.user.id)!,
    samRent: cycle.payments[0],
  };
}

const open = async (token: string, aptId: string, other: string) =>
  (await openItemsRoute(request(`/x?with=${other}`, { token }), routeParams({ id: aptId }))).json();
const record = (token: string, aptId: string, body: object) =>
  recordRoute(request("/x", { method: "POST", token, body }), routeParams({ id: aptId }));
const answer = (token: string, aptId: string, paymentId: string, action: string) =>
  answerRoute(request("/x", { method: "POST", token, body: { action } }), routeParams({ id: aptId, paymentId }));
const owedBySam = async (aptId: string, samId: string, alexId: string) =>
  netDebts(await ledgerEntries(aptId)).find(d => d.from === samId && d.to === alexId)?.amount ?? 0;

describe("Record a payment", () => {
  it("lists what you owe that person and what they owe you", async () => {
    const { alex, sam, apt, samGrocery, alexInternet, samRent } = await household();
    const items = await open(sam.token, apt.id, alex.user.id);
    expect(items.owe.map((i: { id: string }) => i.id).sort()).toEqual([samGrocery.id, samRent.id].sort());
    expect(items.offset.map((i: { id: string }) => i.id)).toEqual([alexInternet.id]);
    expect(items.owe.find((i: { type: string }) => i.type === "rent").label).toBe("Rent October 2026");
  });

  it("subtracts what they owe you, and refuses items you don't owe them or a total of zero", async () => {
    const { alex, sam, apt, samGrocery, alexInternet, samRent } = await household();
    // Alex can't pay Sam for Sam's own rent share.
    expect((await record(alex.token, apt.id, { toUserId: sam.user.id, owe: [{ type: "rent", id: samRent.id }], method: "CASH" })).status).toBe(409);
    expect((await record(sam.token, apt.id, { toUserId: alex.user.id, owe: [], method: "CASH" })).status).toBe(400);
    expect((await record(sam.token, apt.id, { toUserId: alex.user.id, owe: [{ type: "expense", id: samGrocery.id }], method: "GOLD" })).status).toBe(400);

    const res = await record(sam.token, apt.id, {
      toUserId: alex.user.id, method: "VENMO", note: "October",
      owe: [{ type: "expense", id: samGrocery.id }, { type: "rent", id: samRent.id }],
      offset: [{ type: "expense", id: alexInternet.id }],
    });
    expect(res.status).toBe(201);
    expect((await res.json()).amount).toBe(675); // 40 + 650 − 15

    // The same items can't go into a second payment.
    expect((await record(sam.token, apt.id, { toUserId: alex.user.id, owe: [{ type: "expense", id: samGrocery.id }], method: "CASH" })).status).toBe(409);
  });

  it("a waiting payment doesn't count yet; only the person paid can confirm; then everything it covers is paid", async () => {
    const { alex, sam, apt, samGrocery, alexInternet, samRent } = await household();
    const payment = await (await record(sam.token, apt.id, {
      toUserId: alex.user.id, method: "CASH",
      owe: [{ type: "expense", id: samGrocery.id }, { type: "rent", id: samRent.id }], offset: [{ type: "expense", id: alexInternet.id }],
    })).json();

    expect(await owedBySam(apt.id, sam.user.id, alex.user.id)).toBe(675); // still owed while waiting
    const feed = await buildHomeFeed(apt.id, alex.user.id, "ADMIN");
    expect(feed.find(i => i.id === `payment:${payment.id}`)?.title).toMatch(/says they paid you \$675\.00$/);
    expect(feed.some(i => i.id.startsWith("cash:") || i.id === "rent:confirm")).toBe(false); // one item, not one per part

    expect((await answer(sam.token, apt.id, payment.id, "confirm")).status).toBe(403);
    expect((await answer(alex.token, apt.id, payment.id, "confirm")).status).toBe(200);

    expect(await owedBySam(apt.id, sam.user.id, alex.user.id)).toBe(0);
    expect((await prisma.expenseSplit.findUnique({ where: { id: samGrocery.id } }))?.status).toBe("PAID");
    expect((await prisma.expenseSplit.findUnique({ where: { id: alexInternet.id } }))?.status).toBe("PAID");
    expect((await prisma.rentPayment.findUnique({ where: { id: samRent.id } }))?.status).toBe("CONFIRMED");
    expect(await prisma.settlement.count({ where: { apartmentId: apt.id } })).toBe(1); // history kept on the old page too
    expect((await answer(alex.token, apt.id, payment.id, "decline")).status).toBe(409); // already answered
  });

  it("decline and cancel put everything back as it was", async () => {
    const { alex, sam, apt, samGrocery, samRent } = await household();
    const owe = [{ type: "expense", id: samGrocery.id }, { type: "rent", id: samRent.id }];
    const first = await (await record(sam.token, apt.id, { toUserId: alex.user.id, method: "CASH", owe })).json();
    expect((await prisma.rentPayment.findUnique({ where: { id: samRent.id } }))?.status).toBe("PAID"); // waiting, as on the Rent page
    expect((await answer(alex.token, apt.id, first.id, "decline")).status).toBe(200);
    expect((await prisma.rentPayment.findUnique({ where: { id: samRent.id } }))).toMatchObject({ status: "PENDING", paymentId: null });
    expect((await prisma.expenseSplit.findUnique({ where: { id: samGrocery.id } }))).toMatchObject({ status: "PENDING", paymentId: null });

    const second = await (await record(sam.token, apt.id, { toUserId: alex.user.id, method: "CASH", owe })).json();
    expect((await answer(alex.token, apt.id, second.id, "cancel")).status).toBe(403); // only the payer cancels
    expect((await answer(sam.token, apt.id, second.id, "cancel")).status).toBe(200);
    expect(await owedBySam(apt.id, sam.user.id, alex.user.id)).toBe(675); // 40 + 650 − 15 Alex owes Sam: unchanged
    expect(await prisma.payment.count({ where: { apartmentId: apt.id } })).toBe(2); // nothing deleted
  });

  it("the Money check still matches, and Activity gets one line per payment", async () => {
    const { alex, sam, apt, samGrocery, samRent } = await household();
    const payment = await (await record(sam.token, apt.id, {
      toUserId: alex.user.id, method: "BANK", owe: [{ type: "expense", id: samGrocery.id }, { type: "rent", id: samRent.id }],
    })).json();
    expect((await compareWithCurrent(apt.id)).expensesMatch).toBe(true);
    await answer(alex.token, apt.id, payment.id, "confirm");
    expect((await compareWithCurrent(apt.id)).expensesMatch).toBe(true);

    const body = await (await getLedger(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).json();
    expect(body.payments).toEqual([expect.objectContaining({ id: payment.id, amount: 690, status: "CONFIRMED", items: expect.arrayContaining(["Groceries", "Rent October 2026"]) })]);
    expect(body.entries.filter((e: { paymentId?: string; kind: string }) => e.paymentId === payment.id && e.kind === "PAYMENT")).toHaveLength(2);
  });
});
