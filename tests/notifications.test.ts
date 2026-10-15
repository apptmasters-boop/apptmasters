/**
 * Sprint 9b: one notification service (PRODUCT_LOGIC §20). Categories, push and
 * email per category, a quiet period against buzzing in a row, important
 * notifications, and the settings API. Push is replaced by a recorder.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const pushed: string[][] = [];
vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn(async (userIds: string[]) => { pushed.push(userIds); }),
  sendPushToUser: vi.fn(async () => {}),
}));

import { notify, QUIET_MS } from "@/lib/notify";
import { categoryOf, readPrefs } from "@/lib/notificationTypes";
import { GET as getPrefs, PATCH as patchPrefs } from "@/app/api/users/notification-prefs/route";
import { POST as travelRoute } from "@/app/api/apartments/[id]/travel/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

beforeEach(() => { pushed.length = 0; });
const sentEmails = () => (globalThis as unknown as { sentEmails: { to: string; subject: string }[] }).sentEmails;
/** Push and email are sent in the background; give them a moment. */
const settle = () => new Promise(r => setTimeout(r, 20));
const pushedTo = (userId: string) => pushed.some(ids => ids.includes(userId));

async function twoPeople() {
  const a = await createUser();
  const b = await createUser();
  const apt = await createApartment(a.user.id);
  await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: b.user.id } });
  return { a, b, apt };
}
const setPrefs = (userId: string, prefs: object) => prisma.user.update({ where: { id: userId }, data: { notifPrefs: JSON.stringify(prefs) } });

describe("categories", () => {
  it("every type belongs to one", () => {
    expect(categoryOf("RENT_REMINDER")).toBe("RENT");
    expect(categoryOf("EXPENSE_ADDED")).toBe("MONEY");
    expect(categoryOf("CASH_PAYMENT_CLAIMED")).toBe("MONEY");
    expect(categoryOf("PAYMENT_RECORDED")).toBe("MONEY");
    expect(categoryOf("CLEANING_SWAP_REQUEST")).toBe("CLEANING");
    expect(categoryOf("SHOPPING_ITEMS")).toBe("SHOPPING");
    expect(categoryOf("ROTATION_PURCHASED")).toBe("SHOPPING");
    expect(categoryOf("MAINTENANCE_SCHEDULED")).toBe("MAINTENANCE");
    expect(categoryOf("DIRECT_MESSAGE")).toBe("MESSAGES");
    expect(categoryOf("MEMBER_TRAVELING")).toBe("HOUSEHOLD");
    expect(categoryOf("SOMETHING_NEW")).toBe("HOUSEHOLD");
  });

  it("settings default to everything on, and unreadable settings count as defaults", () => {
    const prefs = readPrefs("not json");
    expect(prefs.pushEnabled && prefs.emailEnabled).toBe(true);
    expect(Object.values(prefs.categories).every(c => c.push && c.email)).toBe(true);
    expect(readPrefs(JSON.stringify({ categories: { RENT: { email: false } } })).categories.RENT).toEqual({ push: true, email: false });
  });
});

describe("notify", () => {
  it("always shows in the app; push follows the category and the master switch", async () => {
    const { a, b, apt } = await twoPeople();
    await setPrefs(b.user.id, { categories: { SHOPPING: { push: false } } });
    await notify({ apartmentId: apt.id, userIds: [a.user.id, b.user.id], type: "SHOPPING_TURN", title: "Your turn", body: "Shop" });
    await settle();
    expect(await prisma.notification.count({ where: { apartmentId: apt.id, type: "SHOPPING_TURN" } })).toBe(2);
    expect(pushedTo(a.user.id)).toBe(true);
    expect(pushedTo(b.user.id)).toBe(false);

    await setPrefs(a.user.id, { pushEnabled: false });
    pushed.length = 0;
    await notify({ apartmentId: apt.id, userIds: [a.user.id], type: "MEMBER_JOINED", title: "Hi", body: "New member" });
    await settle();
    expect(pushed).toEqual([]);
  });

  it("emails only those the caller chose, and only if their category allows it", async () => {
    const { a, b, apt } = await twoPeople();
    await setPrefs(b.user.id, { categories: { MONEY: { email: false } } });
    const before = sentEmails().length;
    await notify({ apartmentId: apt.id, userIds: [a.user.id, b.user.id], type: "EXPENSE_ADDED", title: "New expense", body: "Split", sendEmailTo: [a.user.id, b.user.id] });
    await settle();
    const to = sentEmails().slice(before).map(e => e.to);
    expect(to).toContain(a.user.email);
    expect(to).not.toContain(b.user.email);
  });

  it("is quiet for 2 minutes within a category, except for important ones", async () => {
    const { a, apt } = await twoPeople();
    const t0 = new Date("2027-05-01T10:00:00Z");
    const at = (ms: number) => new Date(t0.getTime() + ms);
    const send = (type: string, ms: number, important = false) =>
      notify({ apartmentId: apt.id, userIds: [a.user.id], type, title: type, body: "x", at: at(ms), important });

    await send("EXPENSE_ADDED", 0);
    await send("PAYMENT_RECORDED", 30_000);          // same category (Money), 30 s later
    await send("MAINTENANCE_UPDATED", 40_000);       // another category
    await send("MAINTENANCE_SCHEDULED", 50_000, true); // important: through anyway
    await send("EXPENSE_ADDED", QUIET_MS + 60_000);  // after the quiet period
    await settle();
    expect(pushed.length).toBe(4);
    expect(await prisma.notification.count({ where: { userId: a.user.id } })).toBe(5); // all in the app
  });

  it("notifications that used to be written directly now push too (e.g. travel)", async () => {
    const { a, b, apt } = await twoPeople();
    const res = await travelRoute(request("/x", { method: "POST", token: a.token, body: { userId: a.user.id, startDate: new Date().toISOString() } }), routeParams({ id: apt.id }));
    expect(res.status).toBe(201);
    await settle();
    expect(await prisma.notification.count({ where: { userId: b.user.id, type: "MEMBER_TRAVELING" } })).toBe(1);
    expect(pushedTo(b.user.id)).toBe(true);
  });
});

describe("settings API", () => {
  it("saves per-category choices and returns them with defaults filled in", async () => {
    const { a } = await twoPeople();
    const patch = (body: object) => patchPrefs(request("/x", { method: "PATCH", token: a.token, body }));
    expect((await patch({ categories: { SHOPPING: { push: false } } })).status).toBe(200);
    expect((await patch({ categories: { NOT_A_TOPIC: { push: false } } })).status).toBe(400);

    const prefs = await (await getPrefs(request("/x", { token: a.token }))).json();
    expect(prefs.categories.SHOPPING).toEqual({ push: false, email: true });
    expect(prefs.categories.RENT).toEqual({ push: true, email: true });
    expect(prefs.categoryList).toHaveLength(7);

    await patch({ emailEnabled: false });
    const again = await (await getPrefs(request("/x", { token: a.token }))).json();
    expect(again).toMatchObject({ emailEnabled: false, pushEnabled: true });
    expect(again.categories.SHOPPING.push).toBe(false); // earlier choice kept
  });
});
