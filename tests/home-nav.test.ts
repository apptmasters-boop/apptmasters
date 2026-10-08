/**
 * Sprint 1a: five primary destinations (Home | Household | Money | Chat | More),
 * no back arrow on them, a back arrow to the right one everywhere else, and
 * the unread count behind the Chat badge.
 */
import { describe, it, expect } from "vitest";
import { homeNavState } from "@/lib/homeNav";
import { GET as unread } from "@/app/api/apartments/[id]/chat/unread/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const A = "apt1";
const nav = (path: string) => homeNavState(`/apartment/${A}${path}`, A);

describe("homeNavState", () => {
  it.each([
    ["", "home"], ["/household", "household"], ["/money", "money"], ["/chat", "chat"], ["/more", "more"],
  ])("%s is the primary %s page, with no back arrow", (path, tab) => {
    expect(nav(path)).toEqual({ tab, isPrimary: true, back: null });
  });

  it.each([
    ["/cleaning", "household", "/household", "Household"],
    ["/grocery", "household", "/household", "Household"],
    ["/rent", "money", "/money", "Money"],
    ["/finance", "money", "/money", "Money"],
    ["/calendar", "more", "/more", "More"],
    ["/maintenance", "more", "/more", "More"],
    ["/members/u1", "home", "", "Home"],
  ])("%s belongs to %s and goes back to it", (path, tab, backPath, label) => {
    expect(nav(path)).toEqual({ tab, isPrimary: false, back: { href: `/apartment/${A}${backPath}`, label } });
  });

  it("keeps a direct-message thread under Chat", () => {
    expect(nav("/chat/dm/u2").tab).toBe("chat");
  });
});

describe("GET /api/apartments/[id]/chat/unread", () => {
  it("counts others' unread group messages and my unread direct messages", async () => {
    const me = await createUser();
    const roommate = await createUser();
    const apt = await createApartment(me.user.id);
    await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: roommate.user.id } });

    await prisma.chatMessage.createMany({ data: [
      { apartmentId: apt.id, senderId: roommate.user.id, content: "hi" },                                  // unread
      { apartmentId: apt.id, senderId: roommate.user.id, content: "seen", readBy: JSON.stringify([me.user.id]) }, // read
      { apartmentId: apt.id, senderId: me.user.id, content: "mine" },                                      // my own
    ] });
    await prisma.directMessage.create({ data: { apartmentId: apt.id, senderId: roommate.user.id, receiverId: me.user.id, content: "psst" } });

    const res = await unread(request(`/api/apartments/${apt.id}/chat/unread`, { token: me.token }), routeParams({ id: apt.id }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ group: 1, direct: 1, total: 2 });
  });

  it("is only available to members", async () => {
    const me = await createUser();
    const outsider = await createUser();
    const apt = await createApartment(me.user.id);
    const res = await unread(request(`/api/apartments/${apt.id}/chat/unread`, { token: outsider.token }), routeParams({ id: apt.id }));
    expect(res.status).toBe(403);
  });
});
