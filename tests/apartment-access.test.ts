/**
 * Apartment data must only be visible to that apartment's approved members.
 * Access is enforced by src/lib/access.ts (requireApartmentMember /
 * requireApartmentAdmin); these tests pin that behaviour down.
 *
 * History: before 2026-10-03, about 40 handlers only checked that the caller
 * was signed in, and 55 more let members whose join request was still pending
 * through. Every case below failed then.
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { GET as apartment } from "@/app/api/apartments/[id]/route";
import { GET as chat } from "@/app/api/apartments/[id]/chat/route";
import { GET as grocery } from "@/app/api/apartments/[id]/grocery/route";
import { PATCH as editGroceryItem } from "@/app/api/apartments/[id]/grocery/[itemId]/route";
import { GET as inventory } from "@/app/api/apartments/[id]/inventory/route";
import { GET as calendar, POST as addEvent } from "@/app/api/apartments/[id]/calendar/route";
import { PATCH as editEvent } from "@/app/api/apartments/[id]/calendar/[eventId]/route";
import { GET as feed } from "@/app/api/apartments/[id]/feed/route";
import { GET as fund } from "@/app/api/apartments/[id]/fund/route";
import { createUser, createApartment, request, routeParams } from "./helpers";

type Handler = (req: ReturnType<typeof request>, ctx: ReturnType<typeof routeParams<{ id: string }>>) => Promise<Response>;

async function setup() {
  const member = await createUser();
  const outsider = await createUser();
  const apt = await createApartment(member.user.id);
  return { member, outsider, apt };
}

/** Adds `userId` to the apartment with the given role/status. */
async function addMember(apartmentId: string, userId: string, role = "MEMBER", status = "ACTIVE") {
  return prisma.apartmentMember.create({ data: { apartmentId, userId, role, status } });
}

const routes: { name: string; handler: Handler }[] = [
  { name: "apartment details", handler: apartment as Handler },
  { name: "group chat", handler: chat as Handler },
  { name: "grocery list", handler: grocery as Handler },
  { name: "inventory", handler: inventory as Handler },
  { name: "calendar", handler: calendar as Handler },
  { name: "activity feed", handler: feed as Handler },
  { name: "house fund", handler: fund as Handler },
];

describe.each(routes)("GET apartment $name", ({ handler }) => {
  const call = (aptId: string, token?: string) =>
    handler(request(`/api/apartments/${aptId}`, { token }), routeParams({ id: aptId }));

  it("rejects requests without a token", async () => {
    const { apt } = await setup();
    expect((await call(apt.id)).status).toBe(401);
  });

  it("lets a member read it", async () => {
    const { member, apt } = await setup();
    expect((await call(apt.id, member.token)).status).toBe(200);
  });

  it("blocks a signed-in user from another apartment", async () => {
    const { outsider, apt } = await setup();
    expect((await call(apt.id, outsider.token)).status).toBe(403);
  });

  it("blocks a member whose join request is still pending", async () => {
    const { outsider, apt } = await setup();
    await addMember(apt.id, outsider.user.id, "MEMBER", "PENDING_APPROVAL");
    expect((await call(apt.id, outsider.token)).status).toBe(403);
  });
});

describe("cross-apartment item access", () => {
  it("cannot edit another apartment's grocery item through your own apartment's URL", async () => {
    const { member: attacker } = await setup();
    const attackerApt = await createApartment(attacker.user.id);
    const { member: victim, apt: victimApt } = await setup();
    const item = await prisma.groceryItem.create({
      data: { name: "milk", apartmentId: victimApt.id, addedById: victim.user.id },
    });

    const res = await editGroceryItem(
      request(`/api/apartments/${attackerApt.id}/grocery/${item.id}`, { method: "PATCH", token: attacker.token, body: { name: "hacked" } }),
      routeParams({ id: attackerApt.id, itemId: item.id }),
    );
    expect(res.status).toBe(404);
    expect((await prisma.groceryItem.findUnique({ where: { id: item.id } }))?.name).toBe("milk");
  });
});

describe("calendar event ownership", () => {
  async function eventBy(token: string, aptId: string) {
    const res = await addEvent(
      request(`/api/apartments/${aptId}/calendar`, { method: "POST", token, body: { title: "Movie night", startDate: "2026-11-01" } }),
      routeParams({ id: aptId }),
    );
    expect(res.status).toBe(201);
    return (await res.json()).id as string;
  }
  const edit = (token: string, aptId: string, eventId: string) =>
    editEvent(
      request(`/api/apartments/${aptId}/calendar/${eventId}`, { method: "PATCH", token, body: { title: "Changed" } }),
      routeParams({ id: aptId, eventId }),
    );

  it("lets the creator edit their event", async () => {
    const { member, apt } = await setup();
    const eventId = await eventBy(member.token, apt.id);
    expect((await edit(member.token, apt.id, eventId)).status).toBe(200);
  });

  it("stops another regular member from editing it", async () => {
    const { member, outsider: roommate, apt } = await setup();
    await addMember(apt.id, roommate.user.id);
    const eventId = await eventBy(roommate.token, apt.id);
    // `member` is the apartment ADMIN in setup(); make a second plain member to test with
    const plain = await createUser();
    await addMember(apt.id, plain.user.id);
    expect((await edit(plain.token, apt.id, eventId)).status).toBe(403);
    // ...while an admin still can
    expect((await edit(member.token, apt.id, eventId)).status).toBe(200);
  });
});
