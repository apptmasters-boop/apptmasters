/**
 * Sprint 4a: one household shopping turn, the trip one card at a time
 * (prepare → inventory → at the store → total + receipt → left the store),
 * and the shared list (PRODUCT_LOGIC §10; owner's flow 2026-10-09).
 */
import { describe, it, expect } from "vitest";
import { GET as getShopping } from "@/app/api/apartments/[id]/shopping/route";
import { POST as tripStep } from "@/app/api/apartments/[id]/shopping/trip/route";
import { PUT as setOrder } from "@/app/api/apartments/[id]/shopping/order/route";
import { GET as listItems, POST as addItem } from "@/app/api/apartments/[id]/grocery/route";
import { buildHomeFeed } from "@/lib/homeFeed";
import { syncOrder } from "@/lib/rotation";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

/** Alex (admin, joined first), Sam and Kim, plus a guest who never shops. */
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
const state = async (token: string, aptId: string) =>
  (await getShopping(request("/x", { token }), routeParams({ id: aptId }))).json();
const step = (token: string, aptId: string, action: string, extra: object = {}) =>
  tripStep(request("/x", { method: "POST", token, body: { action, ...extra } }), routeParams({ id: aptId }));
const RECEIPT = "/uploads/receipts/0b5f8d3e-1c2a-4c55-9d7e-2f6a1b3c4d5e.jpg";
/** Start → skip inventory → at the store → pay → left the store. */
async function fullTrip(token: string, aptId: string) {
  for (const a of ["start", "skip_inventory", "at_store"]) await step(token, aptId, a);
  await step(token, aptId, "checkout", { total: 42.5, receiptUrl: RECEIPT });
  return step(token, aptId, "left_store");
}
const add = (token: string, aptId: string, name: string) =>
  addItem(request("/x", { method: "POST", token, body: { name } }), routeParams({ id: aptId }));

describe("syncOrder", () => {
  it("drops people who left, adds newcomers at the end, and keeps the current turn", () => {
    expect(syncOrder(["a", "b", "c"], 1, ["a", "b", "c", "d"])).toEqual({ order: ["a", "b", "c", "d"], currentIndex: 1 });
    expect(syncOrder(["a", "b", "c"], 2, ["c", "a"])).toEqual({ order: ["a", "c"], currentIndex: 1 });
  });
  it("starts with everyone in the order given", () => {
    expect(syncOrder([], 0, ["a", "b"])).toEqual({ order: ["a", "b"], currentIndex: 0 });
  });
});

describe("shopping turn and trip", () => {
  it("everyone but guests takes part, in the order they joined", async () => {
    const { alex, sam, kim, apt } = await household();
    const s = await state(sam.token, apt.id);
    expect(s.order.map((p: { id: string }) => p.id)).toEqual([alex.user.id, sam.user.id, kim.user.id]);
    expect(s.shopper.id).toBe(alex.user.id);
    expect(s.next.id).toBe(sam.user.id);
    expect(s.trip).toBeNull();
  });

  it("only the shopper starts and moves the trip on, one card at a time", async () => {
    const { alex, sam, guest, apt } = await household();
    expect((await step(sam.token, apt.id, "start")).status).toBe(403);
    expect((await step(guest.token, apt.id, "start")).status).toBe(403);
    expect((await step(alex.token, apt.id, "start")).status).toBe(201);
    expect((await step(alex.token, apt.id, "start")).status).toBe(409); // one trip at a time

    expect((await step(alex.token, apt.id, "at_store")).status).toBe(409); // inventory card first
    expect((await step(sam.token, apt.id, "inventory_done")).status).toBe(403);
    expect((await step(alex.token, apt.id, "inventory_done")).status).toBe(200);
    expect((await step(alex.token, apt.id, "left_store")).status).toBe(409); // can't leave before paying
    expect((await step(alex.token, apt.id, "at_store")).status).toBe(200);
    expect((await state(sam.token, apt.id)).trip.status).toBe("SHOPPING");
    expect((await step(alex.token, apt.id, "at_store")).status).toBe(409); // no going back
  });

  it("the inventory can be skipped", async () => {
    const { alex, apt } = await household();
    await step(alex.token, apt.id, "start");
    expect((await step(alex.token, apt.id, "skip_inventory")).status).toBe(200);
    expect((await state(alex.token, apt.id)).trip).toMatchObject({ status: "READY", homeCheck: "SKIPPED" });
  });

  it("checkout needs a total and a receipt (or \"no receipt\"), and can be corrected", async () => {
    const { alex, apt } = await household();
    for (const a of ["start", "skip_inventory", "at_store"]) await step(alex.token, apt.id, a);
    expect((await step(alex.token, apt.id, "checkout", { total: 0, receiptUrl: RECEIPT })).status).toBe(400);
    expect((await step(alex.token, apt.id, "checkout", { total: 99999, receiptUrl: RECEIPT })).status).toBe(400);
    expect((await step(alex.token, apt.id, "checkout", { total: 20 })).status).toBe(400);
    expect((await step(alex.token, apt.id, "checkout", { total: 20, receiptUrl: "https://evil.example/x.jpg" })).status).toBe(400);
    expect((await step(alex.token, apt.id, "checkout", { total: 84.6, receiptUrl: RECEIPT })).status).toBe(200);
    expect((await step(alex.token, apt.id, "checkout", { total: 48.6, noReceipt: true })).status).toBe(200);
    expect((await state(alex.token, apt.id)).trip).toMatchObject({ status: "CHECKED_OUT", totalAmount: 48.6, receiptUrl: null });
  });

  it("leaving the store keeps unticked items, takes ticked ones off the list and passes the turn", async () => {
    const { alex, sam, apt } = await household();
    const milk = await (await add(sam.token, apt.id, "Milk")).json();
    await add(sam.token, apt.id, "Rice");
    await prisma.groceryItem.update({ where: { id: milk.id }, data: { purchased: true } });

    expect((await fullTrip(alex.token, apt.id)).status).toBe(200);

    const list = await (await listItems(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).json();
    expect(list.map((i: { name: string }) => i.name)).toEqual(["Rice"]);
    const s = await state(sam.token, apt.id);
    expect(s.trip).toBeNull();
    expect(s.shopper.id).toBe(sam.user.id);
    expect(s.lastTrip).toMatchObject({ itemCount: 1, totalAmount: 42.5 });

    const note = await prisma.notification.findFirst({ where: { userId: sam.user.id, type: "SHOPPING_TURN" } });
    expect(note?.link).toBe(`/apartment/${apt.id}/shopping`);
  });

  it("skips someone who is away when passing the turn", async () => {
    const { alex, sam, kim, apt } = await household();
    await prisma.travelPeriod.create({ data: { apartmentId: apt.id, userId: sam.user.id, startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000) } });
    await fullTrip(alex.token, apt.id);
    expect((await state(alex.token, apt.id)).shopper.id).toBe(kim.user.id);
  });

  it("cancelling a trip keeps the turn with the shopper", async () => {
    const { alex, apt } = await household();
    await step(alex.token, apt.id, "start");
    expect((await step(alex.token, apt.id, "cancel")).status).toBe(200);
    const s = await state(alex.token, apt.id);
    expect(s.trip).toBeNull();
    expect(s.shopper.id).toBe(alex.user.id);
  });

  it("shows the shopper their turn on Home once there's something on the list", async () => {
    const { alex, sam, apt } = await household();
    const ids = async () => (await buildHomeFeed(apt.id, alex.user.id, "ADMIN")).map(i => i.id);
    expect(await ids()).not.toContain("shopping-turn");
    await add(sam.token, apt.id, "Bread");
    expect(await ids()).toContain("shopping-turn");
    expect((await buildHomeFeed(apt.id, sam.user.id, "MEMBER")).map(i => i.id)).not.toContain("shopping-turn");
    await step(alex.token, apt.id, "start");
    expect(await ids()).toContain("shopping-trip");
  });
});

describe("shared list", () => {
  it("doesn't add the same item twice (e.g. again from the inventory)", async () => {
    const { alex, sam, apt } = await household();
    const first = await (await add(sam.token, apt.id, "Olive oil")).json();
    const again = await (await add(alex.token, apt.id, "  olive OIL ")).json();
    expect(again).toMatchObject({ id: first.id, alreadyOnList: true });
    expect(await prisma.groceryItem.count({ where: { apartmentId: apt.id } })).toBe(1);
  });
});

describe("shopping order", () => {
  it("only admins change it; it must list everyone once; the first person shops next", async () => {
    const { alex, sam, kim, apt } = await household();
    const put = (token: string, memberIds: unknown) =>
      setOrder(request("/x", { method: "PUT", token, body: { memberIds } }), routeParams({ id: apt.id }));
    const newOrder = [kim.user.id, alex.user.id, sam.user.id];

    expect((await put(sam.token, newOrder)).status).toBe(403);
    expect((await put(alex.token, [kim.user.id, alex.user.id])).status).toBe(400);
    expect((await put(alex.token, [kim.user.id, kim.user.id, sam.user.id])).status).toBe(400);
    expect((await put(alex.token, newOrder)).status).toBe(200);
    expect((await state(alex.token, apt.id)).shopper.id).toBe(kim.user.id);

    await step(kim.token, apt.id, "start");
    expect((await put(alex.token, [alex.user.id, sam.user.id, kim.user.id])).status).toBe(409); // not during a trip
  });
});
