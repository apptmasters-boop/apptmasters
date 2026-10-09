/**
 * Sprint 3b: "Can't clean this week?" — the person whose turn it is asks the
 * next person to swap; nothing changes until that person accepts (owner's
 * choice, 2026-10-09).
 */
import { describe, it, expect } from "vitest";
import { POST as askSwap } from "@/app/api/apartments/[id]/cleaning/[rotationId]/swap/route";
import { POST as answer } from "@/app/api/apartments/[id]/cleaning/swaps/[swapId]/route";
import { GET as history } from "@/app/api/apartments/[id]/cleaning/[rotationId]/history/route";
import { buildHomeFeed } from "@/lib/homeFeed";
import { swapPositions } from "@/lib/rotation";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

async function household() {
  const alex = await createUser();
  const sam = await createUser();
  const kim = await createUser();
  const apt = await createApartment(alex.user.id);
  await prisma.apartmentMember.createMany({ data: [{ apartmentId: apt.id, userId: sam.user.id }, { apartmentId: apt.id, userId: kim.user.id }] });
  const rotation = await prisma.cleaningRotation.create({
    data: { name: "Cleaning", apartmentId: apt.id, memberOrder: JSON.stringify([alex.user.id, sam.user.id, kim.user.id]), currentIndex: 0, nextDue: new Date() },
  });
  return { alex, sam, kim, apt, rotation };
}
const ask = (token: string, aptId: string, rotationId: string, reason?: string) =>
  askSwap(request(`/x`, { method: "POST", token, body: { reason } }), routeParams({ id: aptId, rotationId }));
const respond = (token: string, aptId: string, swapId: string, action: string) =>
  answer(request(`/x`, { method: "POST", token, body: { action } }), routeParams({ id: aptId, swapId }));
const currentOf = async (rotationId: string) => {
  const r = await prisma.cleaningRotation.findUnique({ where: { id: rotationId } });
  return JSON.parse(r!.memberOrder)[r!.currentIndex];
};

describe("swapPositions", () => {
  it("trades two people's places and leaves the rest", () => {
    expect(swapPositions(["a", "b", "c"], "a", "b")).toEqual(["b", "a", "c"]);
  });
});

describe("cleaning swap requests", () => {
  it("only the person whose turn it is can ask", async () => {
    const { sam, apt, rotation } = await household();
    expect((await ask(sam.token, apt.id, rotation.id)).status).toBe(403);
  });

  it("asks the next person, shows it on their Home, and refuses a second request", async () => {
    const { alex, sam, apt, rotation } = await household();
    const res = await ask(alex.token, apt.id, rotation.id, "Exams this week");
    expect(res.status).toBe(201);
    expect((await res.json()).targetId).toBe(sam.user.id);

    const feed = await buildHomeFeed(apt.id, sam.user.id, "MEMBER");
    expect(feed.find(i => i.id.startsWith("cleaning-swap:"))?.detail).toBe("Exams this week");
    expect((await ask(alex.token, apt.id, rotation.id)).status).toBe(409);
  });

  it("on accept they trade places: Sam cleans now, Alex goes after him", async () => {
    const { alex, sam, kim, apt, rotation } = await household();
    const { id } = await (await ask(alex.token, apt.id, rotation.id)).json();

    expect((await respond(kim.token, apt.id, id, "accept")).status).toBe(403); // not the person asked
    expect((await respond(sam.token, apt.id, id, "accept")).status).toBe(200);
    expect(await currentOf(rotation.id)).toBe(sam.user.id);
    const order = JSON.parse((await prisma.cleaningRotation.findUnique({ where: { id: rotation.id } }))!.memberOrder);
    expect(order).toEqual([sam.user.id, alex.user.id, kim.user.id]);

    const res = await history(request(`/x`, { token: alex.token }), routeParams({ id: apt.id, rotationId: rotation.id }));
    const { swaps } = await res.json();
    expect(swaps[0]).toMatchObject({ requester: { id: alex.user.id }, target: { id: sam.user.id } });
  });

  it("decline leaves the turn with the requester", async () => {
    const { alex, sam, apt, rotation } = await household();
    const { id } = await (await ask(alex.token, apt.id, rotation.id)).json();
    expect((await respond(sam.token, apt.id, id, "decline")).status).toBe(200);
    expect(await currentOf(rotation.id)).toBe(alex.user.id);
  });

  it("only the requester can cancel, and an answered request can't be answered again", async () => {
    const { alex, sam, apt, rotation } = await household();
    const { id } = await (await ask(alex.token, apt.id, rotation.id)).json();
    expect((await respond(sam.token, apt.id, id, "cancel")).status).toBe(403);
    expect((await respond(alex.token, apt.id, id, "cancel")).status).toBe(200);
    expect((await respond(sam.token, apt.id, id, "accept")).status).toBe(409);
  });

  it("refuses an accept once the turn has already moved on", async () => {
    const { alex, sam, apt, rotation } = await household();
    const { id } = await (await ask(alex.token, apt.id, rotation.id)).json();
    await prisma.cleaningRotation.update({ where: { id: rotation.id }, data: { currentIndex: 1 } }); // Alex cleaned anyway
    expect((await respond(sam.token, apt.id, id, "accept")).status).toBe(409);
    expect((await prisma.cleaningSwapRequest.findUnique({ where: { id } }))?.status).toBe("CANCELLED");
  });
});
