/**
 * Sprint 3a: cleaning rotation — who's next, the Schedule (skipping people who
 * are away), and History (PRODUCT_LOGIC §8).
 */
import { describe, it, expect } from "vitest";
import { upcomingTurns, nextMemberIndex, isAwayOn, type TravelSpan } from "@/lib/rotation";
import { GET as listRotations } from "@/app/api/apartments/[id]/cleaning/route";
import { POST as markCleaned } from "@/app/api/apartments/[id]/cleaning/[rotationId]/route";
import { GET as history } from "@/app/api/apartments/[id]/cleaning/[rotationId]/history/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const DAY = 86_400_000;
const d0 = new Date("2026-11-02T10:00:00Z");
const trip = (userId: string, from: Date, to: Date): TravelSpan => ({ userId, startDate: from, endDate: to, returnedAt: null });

describe("rotation rules", () => {
  it("lists the next turns in order, one period apart", () => {
    const turns = upcomingTurns({ memberOrder: ["a", "b", "c"], currentIndex: 0, nextDue: d0, frequency: "WEEKLY" }, [], 4);
    expect(turns.map(t => t.userId)).toEqual(["a", "b", "c", "a"]);
    expect(turns[1].due!.getTime() - d0.getTime()).toBe(7 * DAY);
  });

  it("skips someone who'll be away on their turn's date", () => {
    const awayWeek2 = trip("b", new Date(d0.getTime() + 6 * DAY), new Date(d0.getTime() + 8 * DAY));
    const turns = upcomingTurns({ memberOrder: ["a", "b", "c"], currentIndex: 0, nextDue: d0, frequency: "WEEKLY" }, [awayWeek2], 3);
    expect(turns.map(t => t.userId)).toEqual(["a", "c", "a"]);
  });

  it("doesn't count a trip the person already came back from", () => {
    expect(isAwayOn([{ ...trip("b", d0, new Date(d0.getTime() + DAY)), returnedAt: d0 }], "b", d0)).toBe(false);
  });

  it("moves on to the next person even if everyone is away", () => {
    expect(nextMemberIndex(["a", "b"], 0, () => true)).toBe(1);
  });
});

describe("cleaning API", () => {
  async function household() {
    const me = await createUser();
    const roommate = await createUser();
    const apt = await createApartment(me.user.id);
    await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: roommate.user.id } });
    const rotation = await prisma.cleaningRotation.create({
      data: { name: "Cleaning", apartmentId: apt.id, memberOrder: JSON.stringify([me.user.id, roommate.user.id]), currentIndex: 0, nextDue: new Date(Date.now() - DAY) },
    });
    return { me, roommate, apt, rotation };
  }

  it("includes the next 6 turns as a schedule", async () => {
    const { me, roommate, apt } = await household();
    const res = await listRotations(request(`/api/apartments/${apt.id}/cleaning`, { token: me.token }), routeParams({ id: apt.id }));
    const [rot] = await res.json();
    expect(rot.schedule).toHaveLength(6);
    expect(rot.schedule.slice(0, 2).map((t: { userId: string }) => t.userId)).toEqual([me.user.id, roommate.user.id]);
  });

  it("marking my turn cleaned saves history and passes the turn on", async () => {
    const { me, roommate, apt, rotation } = await household();
    const done = await markCleaned(
      request(`/api/apartments/${apt.id}/cleaning/${rotation.id}`, { method: "POST", token: me.token, body: { notes: "Kitchen too" } }),
      routeParams({ id: apt.id, rotationId: rotation.id }));
    expect(done.status).toBe(200);

    const after = await prisma.cleaningRotation.findUnique({ where: { id: rotation.id } });
    expect(JSON.parse(after!.memberOrder)[after!.currentIndex]).toBe(roommate.user.id);

    const res = await history(request(`/api/apartments/${apt.id}/cleaning/${rotation.id}/history`, { token: me.token }),
      routeParams({ id: apt.id, rotationId: rotation.id }));
    const logs = await res.json();
    expect(logs[0]).toMatchObject({ notes: "Kitchen too", cleanedBy: { id: me.user.id } });
  });

  it("doesn't show another home's history", async () => {
    const a = await household();
    const b = await household();
    const res = await history(request(`/api/apartments/${a.apt.id}/cleaning/${b.rotation.id}/history`, { token: a.me.token }),
      routeParams({ id: a.apt.id, rotationId: b.rotation.id }));
    expect(res.status).toBe(404);
  });
});
