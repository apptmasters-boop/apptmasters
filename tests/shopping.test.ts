/**
 * Sprint 4a: one household shopping turn, the trip steps, and the shared list
 * (PRODUCT_LOGIC §10.1, §10.4, §10.5).
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
const step = (token: string, aptId: string, action: string) =>
  tripStep(request("/x", { method: "POST", token, body: { action } }), routeParams({ id: aptId }));
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

  it("only the shopper starts and moves the trip on, one step at a time", async () => {
    const { alex, sam, guest, apt } = await household();
    expect((await step(sam.token, apt.id, "start")).status).toBe(403);
    expect((await step(guest.token, apt.id, "start")).status).toBe(403);
    expect((await step(alex.token, apt.id, "start")).status).toBe(201);
    expect((await step(alex.token, apt.id, "start")).status).toBe(409); // one trip at a time

    expect((await step(alex.token, apt.id, "left_store")).status).toBe(409); // can't skip "at the store"
    expect((await step(sam.token, apt.id, "at_store")).status).toBe(403);
    expect((await step(alex.token, apt.id, "at_store")).status).toBe(200);
    expect((await state(sam.token, apt.id)).trip.status).toBe("SHOPPING");
    expect((await step(alex.token, apt.id, "at_store")).status).toBe(409); // no going back
    expect((await step(alex.token, apt.id, "left_store")).status).toBe(200);
  });

  it("finishing keeps unticked items, takes ticked ones off the list and passes the turn", async () => {
    const { alex, sam, apt } = await household();
    const milk = await (await add(sam.token, apt.id, "Milk")).json();
    await add(sam.token, apt.id, "Rice");
    await prisma.groceryItem.update({ where: { id: milk.id }, data: { purchased: true } });

    await step(alex.token, apt.id, "start");
    await step(alex.token, apt.id, "at_store");
    expect((await step(alex.token, apt.id, "finish")).status).toBe(200); // finishing without "left the store" is allowed

    const list = await (await listItems(request("/x", { token: sam.token }), routeParams({ id: apt.id }))).json();
    expect(list.map((i: { name: string }) => i.name)).toEqual(["Rice"]);
    const s = await state(sam.token, apt.id);
    expect(s.trip).toBeNull();
    expect(s.shopper.id).toBe(sam.user.id);
    expect(s.lastTrip.itemCount).toBe(1);

    const note = await prisma.notification.findFirst({ where: { userId: sam.user.id, type: "SHOPPING_TURN" } });
    expect(note?.link).toBe(`/apartment/${apt.id}/shopping`);
  });

  it("skips someone who is away when passing the turn", async () => {
    const { alex, sam, kim, apt } = await household();
    await prisma.travelPeriod.create({ data: { apartmentId: apt.id, userId: sam.user.id, startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000) } });
    await step(alex.token, apt.id, "start");
    await step(alex.token, apt.id, "at_store");
    await step(alex.token, apt.id, "finish");
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
