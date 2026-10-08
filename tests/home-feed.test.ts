/**
 * Sprint 2a: the Home priority feed (PRODUCT_LOGIC §6) — P1 critical → P5 info,
 * only what concerns the viewer, and never ordinary chat messages.
 */
import { describe, it, expect } from "vitest";
import { buildHomeFeed, sortFeed, rentDueDate, type FeedItem } from "@/lib/homeFeed";
import { GET as homeRoute } from "@/app/api/apartments/[id]/home/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const DAY = 86_400_000;

async function household() {
  const me = await createUser();
  const roommate = await createUser();
  const apt = await createApartment(me.user.id); // me = ADMIN
  await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: roommate.user.id } });
  return { me, roommate, apt };
}
const feedFor = (aptId: string, userId: string, role = "MEMBER") => buildHomeFeed(aptId, userId, role);
const titles = (items: FeedItem[]) => items.map(i => i.title);

describe("sortFeed / rentDueDate", () => {
  it("orders by priority, then earliest date, undated last", () => {
    const items: FeedItem[] = [
      { id: "a", priority: 3, title: "later turn", href: "", when: "2026-10-10T00:00:00Z" },
      { id: "b", priority: 1, title: "urgent", href: "" },
      { id: "c", priority: 3, title: "undated", href: "" },
      { id: "d", priority: 3, title: "sooner turn", href: "", when: "2026-10-09T00:00:00Z" },
    ];
    expect(titles(sortFeed(items))).toEqual(["urgent", "sooner turn", "later turn", "undated"]);
  });

  it("clamps a due day of 31 to the end of short months", () => {
    expect(rentDueDate("2026-02", 31).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(rentDueDate("2026-10", 5).toISOString().slice(0, 10)).toBe("2026-10-05");
  });
});

describe("buildHomeFeed", () => {
  it("puts an unresolved urgent repair first, and drops it once resolved", async () => {
    const { me, apt } = await household();
    const repair = await prisma.maintenanceRequest.create({
      data: { title: "Water leak", description: "kitchen", priority: "URGENT", apartmentId: apt.id, submittedById: me.user.id },
    });
    await prisma.maintenanceRequest.create({
      data: { title: "Squeaky door", description: "x", priority: "LOW", apartmentId: apt.id, submittedById: me.user.id },
    });
    await prisma.calendarEvent.create({ data: { title: "Dinner", startDate: new Date(Date.now() + 2 * DAY), apartmentId: apt.id, userId: me.user.id } });

    const feed = await feedFor(apt.id, me.user.id);
    expect(feed[0]).toMatchObject({ priority: 1, title: "Urgent repair: Water leak" });
    expect(titles(feed).join()).not.toContain("Squeaky door");

    await prisma.maintenanceRequest.update({ where: { id: repair.id }, data: { status: "RESOLVED" } });
    expect(titles(await feedFor(apt.id, me.user.id)).join()).not.toContain("Water leak");
  });

  it("shows my unpaid rent share as overdue for a past month", async () => {
    const { me, roommate, apt } = await household();
    const cycle = await prisma.rentCycle.create({ data: { month: "2026-01", totalAmount: 1950, apartmentId: apt.id, rentPayerId: roommate.user.id } });
    await prisma.rentPayment.create({ data: { amount: 650, rentCycleId: cycle.id, userId: me.user.id } });

    const rent = (await feedFor(apt.id, me.user.id)).find(i => i.id === "rent:mine");
    expect(rent).toMatchObject({ priority: 2, overdue: true, title: "Your rent share is overdue: $650.00" });
  });

  it("tells me what I owe in shared expenses, and the payer nothing", async () => {
    const { me, roommate, apt } = await household();
    await prisma.expense.create({
      data: {
        title: "Groceries", amount: 60, apartmentId: apt.id, paidById: roommate.user.id,
        splits: { create: [{ userId: me.user.id, amount: 30 }, { userId: roommate.user.id, amount: 30 }] },
      },
    });
    expect((await feedFor(apt.id, me.user.id)).find(i => i.id === "expenses:owed")?.title).toBe("You owe $30.00 in shared expenses");
    expect((await feedFor(apt.id, roommate.user.id)).find(i => i.id === "expenses:owed")).toBeUndefined();
  });

  it("shows the cleaning turn only to the person whose turn it is", async () => {
    const { me, roommate, apt } = await household();
    await prisma.cleaningRotation.create({
      data: { name: "Cleaning", apartmentId: apt.id, memberOrder: JSON.stringify([me.user.id, roommate.user.id]), currentIndex: 0, nextDue: new Date(Date.now() + DAY) },
    });
    expect(titles(await feedFor(apt.id, me.user.id))).toContain("It's your turn to clean");
    expect(titles(await feedFor(apt.id, roommate.user.id))).not.toContain("It's your turn to clean");
  });

  it("lists events in the next 7 days under Coming up, not ones weeks away", async () => {
    const { me, apt } = await household();
    await prisma.calendarEvent.create({ data: { title: "Plumber visit", startDate: new Date(Date.now() + 3 * DAY), apartmentId: apt.id, userId: me.user.id } });
    await prisma.calendarEvent.create({ data: { title: "Far away party", startDate: new Date(Date.now() + 21 * DAY), apartmentId: apt.id, userId: me.user.id } });
    const feed = await feedFor(apt.id, me.user.id);
    expect(feed.find(i => i.title === "Plumber visit")?.priority).toBe(4);
    expect(titles(feed)).not.toContain("Far away party");
  });

  it("never turns chat messages into Home items", async () => {
    const { me, roommate, apt } = await household();
    await prisma.chatMessage.create({ data: { apartmentId: apt.id, senderId: roommate.user.id, content: "Hi!" } });
    expect(await feedFor(apt.id, me.user.id)).toEqual([]);
  });

  it("shows join requests to household admins only", async () => {
    const { me, roommate, apt } = await household();
    const { user: newcomer } = await createUser();
    await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: newcomer.id, status: "PENDING_APPROVAL" } });
    const adminFeed = await feedFor(apt.id, me.user.id, "ADMIN");
    expect(adminFeed.find(i => i.id === "join-requests")).toMatchObject({ title: "1 person wants to join", href: `/apartment/${apt.id}/settings` });
    expect(titles(await feedFor(apt.id, roommate.user.id, "MEMBER"))).not.toContain("1 person wants to join");
  });
});

describe("GET /api/apartments/[id]/home", () => {
  it("returns the feed to members and refuses outsiders", async () => {
    const { me, apt } = await household();
    const outsider = await createUser();
    const ok = await homeRoute(request(`/api/apartments/${apt.id}/home`, { token: me.token }), routeParams({ id: apt.id }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ apartmentName: "Test Apartment", items: [] });
    const no = await homeRoute(request(`/api/apartments/${apt.id}/home`, { token: outsider.token }), routeParams({ id: apt.id }));
    expect(no.status).toBe(403);
  });
});
