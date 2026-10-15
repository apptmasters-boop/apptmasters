/**
 * Sprint 7a: Rent's two facts (PRODUCT_LOGIC §12.1): was the landlord paid, and
 * did each roommate pay the rent payer back? Plus the monthly summary (§12.2)
 * and history (§12.3).
 */
import { describe, it, expect } from "vitest";
import { GET as summaryRoute } from "@/app/api/apartments/[id]/rent/summary/route";
import { POST as startMonthRoute } from "@/app/api/apartments/[id]/rent/cycles/route";
import { POST as landlordRoute } from "@/app/api/apartments/[id]/rent/cycles/[cycleId]/landlord/route";
import { PATCH as paymentRoute } from "@/app/api/apartments/[id]/rent/cycles/[cycleId]/payments/[paymentId]/route";
import { POST as remindRoute } from "@/app/api/apartments/[id]/rent/remind/route";
import { ledgerEntries, netDebts } from "@/lib/ledger";
import { currentMonth, rentDueDate, summarizeMonth } from "@/lib/rent";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

/** Alex is the household admin; Sam (not an admin) pays the landlord; Alex and Kim pay Sam back $400 each. */
async function household() {
  const alex = await createUser();
  const sam = await createUser();
  const kim = await createUser();
  const apt = await createApartment(alex.user.id);
  await prisma.apartmentMember.createMany({ data: [{ apartmentId: apt.id, userId: sam.user.id }, { apartmentId: apt.id, userId: kim.user.id }] });
  await prisma.rentConfig.create({ data: { apartmentId: apt.id, totalAmount: 1200, dueDay: 5, rentPayerId: sam.user.id, landlordName: "Mr. Lee" } });
  return { alex, sam, kim, apt };
}
const start = (token: string, aptId: string, month = currentMonth()) =>
  startMonthRoute(request("/x", { method: "POST", token, body: { month } }), routeParams({ id: aptId }));
const summary = async (token: string, aptId: string) =>
  (await summaryRoute(request("/x", { token }), routeParams({ id: aptId }))).json();
const landlord = (token: string, aptId: string, cycleId: string, paid: boolean) =>
  landlordRoute(request("/x", { method: "POST", token, body: { paid } }), routeParams({ id: aptId, cycleId }));
const pay = (token: string, aptId: string, cycleId: string, paymentId: string, body: object) =>
  paymentRoute(request("/x", { method: "PATCH", token, body }), routeParams({ id: aptId, cycleId, paymentId }));

describe("Rent: landlord paid vs. roommates reimbursed", () => {
  it("starting a month sets each roommate's share but doesn't mark the landlord paid", async () => {
    const { alex, sam, kim, apt } = await household();
    const res = await start(sam.token, apt.id);
    expect(res.status).toBe(201);
    const s = await summary(kim.token, apt.id);
    const month = s.months[0];
    expect(month).toMatchObject({ month: currentMonth(), landlordPaidAt: null, expected: 800, collected: 0, stillToCollect: 800, payerShare: 400 });
    expect(month.members.map((m: { userId: string; amount: number }) => [m.userId, m.amount]).sort()).toEqual([[alex.user.id, 400], [kim.user.id, 400]].sort());
    expect(s.config).toMatchObject({ totalAmount: 1200, dueDay: 5, landlordName: "Mr. Lee", rentPayer: { id: sam.user.id } });

    // Starting the same month again changes nothing.
    expect((await start(sam.token, apt.id)).status).toBe(200);
    expect(await prisma.rentCycle.count({ where: { apartmentId: apt.id } })).toBe(1);
  });

  it("the landlord payment is its own fact: marking or undoing it doesn't change what roommates owe", async () => {
    const { sam, kim, apt } = await household();
    const cycle = await (await start(sam.token, apt.id)).json();
    const owedBefore = netDebts(await ledgerEntries(apt.id));

    expect((await landlord(kim.token, apt.id, cycle.id, true)).status).toBe(403); // only the rent payer (or an admin)
    expect((await landlord(sam.token, apt.id, cycle.id, true)).status).toBe(200);
    expect((await summary(kim.token, apt.id)).months[0].landlordPaidAt).not.toBeNull();
    expect(netDebts(await ledgerEntries(apt.id))).toEqual(owedBefore);

    expect((await landlord(sam.token, apt.id, cycle.id, false)).status).toBe(200);
    expect((await summary(kim.token, apt.id)).months[0].landlordPaidAt).toBeNull();
  });

  it("only the rent payer or an admin starts a month, and not far in the future", async () => {
    const { alex, kim, apt } = await household();
    expect((await start(kim.token, apt.id)).status).toBe(403);
    expect((await start(alex.token, apt.id, "2099-01")).status).toBe(400);
    expect((await start(alex.token, apt.id)).status).toBe(201); // admin
  });

  it("collected counts confirmed shares; 'says paid' is waiting; the rest is still to collect", async () => {
    const { alex, sam, kim, apt } = await household();
    const cycle = await (await start(sam.token, apt.id)).json();
    const share = (userId: string) => cycle.payments.find((p: { userId: string }) => p.userId === userId).id;

    expect((await pay(alex.token, apt.id, cycle.id, share(alex.user.id), { status: "PAID", method: "ZELLE" })).status).toBe(200);
    let month = (await summary(sam.token, apt.id)).months[0];
    expect(month).toMatchObject({ collected: 0, waiting: 400, stillToCollect: 800 });
    expect(month.members.find((m: { userId: string }) => m.userId === alex.user.id)).toMatchObject({ status: "PAID", method: "ZELLE" });

    await pay(sam.token, apt.id, cycle.id, share(alex.user.id), { status: "CONFIRMED" });
    month = (await summary(kim.token, apt.id)).months[0];
    expect(month).toMatchObject({ collected: 400, waiting: 0, stillToCollect: 400 });
    expect(share(kim.user.id)).toBeTruthy();
  });

  it("the rent payer can send reminders, only to roommates who haven't paid", async () => {
    const { alex, sam, kim, apt } = await household();
    const cycle = await (await start(sam.token, apt.id)).json();
    const alexShare = cycle.payments.find((p: { userId: string }) => p.userId === alex.user.id).id;
    await pay(alex.token, apt.id, cycle.id, alexShare, { status: "PAID", method: "CASH" }); // waiting for confirmation

    const remind = (token: string) => remindRoute(request("/x", { method: "POST", token, body: { cycleId: cycle.id } }), routeParams({ id: apt.id }));
    expect((await remind(kim.token)).status).toBe(403);
    const res = await remind(sam.token);
    expect(res.status).toBe(200);
    expect((await res.json()).reminded).toBe(1);
    // (Starting the month also told everyone their share; that's a different notification.)
    const manual = { type: "RENT_REMINDER", title: "Rent reminder" };
    expect(await prisma.notification.count({ where: { userId: kim.user.id, ...manual } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: alex.user.id, ...manual } })).toBe(0);
  });

  it("history lists months newest first; a month is late once its due day has passed", async () => {
    const { sam, kim, apt } = await household();
    await start(sam.token, apt.id, "2026-06");
    await start(sam.token, apt.id, "2026-08");
    const s = await summary(kim.token, apt.id);
    // (Opening Rent may also start the current month by itself when it's coming due: Sprint 7b.)
    const recorded = s.months.filter((m: { month: string }) => m.month === "2026-08" || m.month === "2026-06");
    expect(recorded.map((m: { month: string }) => m.month)).toEqual(["2026-08", "2026-06"]);
    expect(recorded[0].label).toBe("August 2026");

    const cycle = { id: "c", month: "2026-10", totalAmount: 100, markedPaidAt: null, rentPayer: { id: "p", name: "P" }, payments: [] };
    const due = rentDueDate("2026-10", 5);
    expect(summarizeMonth(cycle, 5, new Date(due.getTime() + 12 * 3_600_000)).late).toBe(false); // still the due day
    expect(summarizeMonth(cycle, 5, new Date(due.getTime() + 25 * 3_600_000)).late).toBe(true);
    expect(summarizeMonth(cycle, 5, due).due).toBe("2026-10-05");
  });
});
