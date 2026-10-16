/**
 * Sprint 11a: "Have you found your new home?" (PRODUCT_LOGIC §3.3). Asked 14
 * days after signing up or 7 days after first messaging a listing owner,
 * whichever comes first; after "I'm still looking", again 14 days later; the
 * daily email never more than once in 14 days. Push is replaced by a recorder.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const pushed: string[][] = [];
vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn(async (userIds: string[]) => { pushed.push(userIds); }),
  sendPushToUser: vi.fn(async () => {}),
}));
// The real sender (Resend is stubbed in setup-env), wrapped so one test can make an email fail.
vi.mock("@/lib/email", async importOriginal => {
  const real = await importOriginal<typeof import("@/lib/email")>();
  return { ...real, sendEmail: vi.fn(real.sendEmail) };
});

import { sendEmail } from "@/lib/email";
import { homeQuestionDueAt, homeQuestionEmailDue, landingPath, type HomeSearchFacts } from "@/lib/housing";
import { runHomeQuestion } from "@/lib/homeSearch";
import { GET as askRoute, POST as answerRoute } from "@/app/api/users/home-search/route";
import { POST as cronRoute } from "@/app/api/cron/home-search/route";
import { GET as me } from "@/app/api/auth/me/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request } from "./helpers";

const SECRET = "test-cron-secret";
beforeAll(() => { process.env.CRON_SECRET = SECRET; });
beforeEach(() => { pushed.length = 0; });

const at = (iso: string) => new Date(iso);
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const sentEmails = () => (globalThis as unknown as { sentEmails: { to: string; subject: string; html: string }[] }).sentEmails;
const emailsTo = (email: string) => sentEmails().filter(m => m.to === email && m.subject === "Have you found your new home?");

const facts = (over: Partial<HomeSearchFacts> = {}): HomeSearchFacts => ({
  createdAt: at("2027-03-01T10:00:00Z"), foundHomeAt: null, stillLookingAt: null,
  hasHome: false, leftHomeAt: null, firstContactAt: null, postsListings: false, ...over,
});

describe("when the question is due", () => {
  it("14 days after signing up", () => {
    expect(homeQuestionDueAt(facts())).toEqual(at("2027-03-15T10:00:00Z"));
  });

  it("or 7 days after first messaging a listing owner, whichever comes first", () => {
    expect(homeQuestionDueAt(facts({ firstContactAt: at("2027-03-03T09:00:00Z") }))).toEqual(at("2027-03-10T09:00:00Z"));
    expect(homeQuestionDueAt(facts({ firstContactAt: at("2027-03-12T09:00:00Z") }))).toEqual(at("2027-03-15T10:00:00Z"));
  });

  it("after \"I'm still looking\", 14 days later", () => {
    expect(homeQuestionDueAt(facts({ stillLookingAt: at("2027-03-15T12:00:00Z") }))).toEqual(at("2027-03-29T12:00:00Z"));
  });

  it("never for someone with a home (or waiting to join one), or who found a place", () => {
    expect(homeQuestionDueAt(facts({ hasHome: true }))).toBeNull();
    expect(homeQuestionDueAt(facts({ foundHomeAt: at("2027-03-05T10:00:00Z") }))).toBeNull();
  });

  it("starts again when they move out of a home, and an old \"I found a place\" no longer counts", () => {
    const moved = facts({ foundHomeAt: at("2027-03-05T10:00:00Z"), leftHomeAt: at("2027-06-01T10:00:00Z") });
    expect(homeQuestionDueAt(moved)).toEqual(at("2027-06-15T10:00:00Z"));
    // A message from the earlier search doesn't bring it forward.
    expect(homeQuestionDueAt({ ...moved, firstContactAt: at("2027-03-03T10:00:00Z") })).toEqual(at("2027-06-15T10:00:00Z"));
  });

  it("not for people who only post listings, unless they also message an owner", () => {
    expect(homeQuestionDueAt(facts({ postsListings: true }))).toBeNull();
    expect(homeQuestionDueAt(facts({ postsListings: true, firstContactAt: at("2027-03-02T10:00:00Z") }))).toEqual(at("2027-03-09T10:00:00Z"));
  });

  it("the daily email: once due, never more than once in 14 days", () => {
    const f = facts();
    expect(homeQuestionEmailDue({ ...f, homeAskedAt: null }, at("2027-03-15T09:00:00Z"))).toBe(false); // not due yet
    expect(homeQuestionEmailDue({ ...f, homeAskedAt: null }, at("2027-03-15T11:00:00Z"))).toBe(true);
    expect(homeQuestionEmailDue({ ...f, homeAskedAt: at("2027-03-15T11:00:00Z") }, at("2027-03-28T11:00:00Z"))).toBe(false);
    // The job runs at about the same time every day: a few minutes early on day 14 still counts.
    expect(homeQuestionEmailDue({ ...f, homeAskedAt: at("2027-03-15T11:05:00Z") }, at("2027-03-29T11:00:00Z"))).toBe(true);
  });
});

describe("GET and POST /api/users/home-search", () => {
  const ask = async (token: string) => (await (await askRoute(request("/api/users/home-search", { token }))).json()).ask;
  const answer = (token: string, a: string) => answerRoute(request("/api/users/home-search", { method: "POST", token, body: { answer: a } }));
  async function seeker(signedUpDaysAgo: number) {
    const s = await createUser();
    await prisma.user.update({ where: { id: s.user.id }, data: { createdAt: daysAgo(signedUpDaysAgo) } });
    return s;
  }

  it("need you to be signed in", async () => {
    expect((await askRoute(request("/api/users/home-search"))).status).toBe(401);
    expect((await answerRoute(request("/api/users/home-search", { method: "POST", body: { answer: "LOOKING" } }))).status).toBe(401);
  });

  it("asks a seeker 14 days after signing up, not before", async () => {
    expect(await ask((await seeker(10)).token)).toBe(false);
    expect(await ask((await seeker(15)).token)).toBe(true);
  });

  it("asks 7 days after the first message to someone else's listing", async () => {
    const s = await seeker(10);
    const owner = await createUser();
    const listing = await prisma.listing.create({
      data: { type: "APARTMENT_FOR_RENT", status: "APPROVED", title: "t", description: "d", price: 1000, city: "c", ownerId: owner.user.id },
    });
    await prisma.listingMessage.create({ data: { content: "Is it free?", listingId: listing.id, senderId: s.user.id, receiverId: owner.user.id, createdAt: daysAgo(8) } });
    expect(await ask(s.token)).toBe(true);
  });

  it("doesn't ask managers or people who live in a home", async () => {
    const manager = await seeker(30);
    await prisma.user.update({ where: { id: manager.user.id }, data: { systemRole: "MANAGER" } });
    expect(await ask(manager.token)).toBe(false);
    const member = await seeker(30);
    await createApartment(member.user.id);
    expect(await ask(member.token)).toBe(false);
  });

  it("\"I'm still looking\" puts the question away for 14 days", async () => {
    const s = await seeker(15);
    expect((await answer(s.token, "LOOKING")).status).toBe(200);
    expect(await ask(s.token)).toBe(false);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } });
    expect(homeQuestionDueAt({ ...facts(), createdAt: after.createdAt, stillLookingAt: after.stillLookingAt })!.getTime())
      .toBe(after.stillLookingAt!.getTime() + 14 * DAY);
  });

  it("\"Yes, I found a place\" makes them FOUND_A_HOME and leads to setting up the home", async () => {
    const s = await seeker(15);
    const res = await answer(s.token, "FOUND");
    expect(res.status).toBe(200);
    expect((await res.json()).next).toBe("/apartment/create");
    expect(await ask(s.token)).toBe(false);

    const profile = await (await me(request("/api/auth/me", { token: s.token }))).json();
    expect(profile.housingState).toBe("FOUND_A_HOME");
    expect(landingPath(profile)).toBe("/apartment/create"); // signing in again lands there too
  });

  it("someone who already has a home can't answer, and the answer must be one of the two", async () => {
    const member = await seeker(15);
    await createApartment(member.user.id);
    expect((await answer(member.token, "FOUND")).status).toBe(409);
    expect((await answer((await seeker(15)).token, "MAYBE")).status).toBe(400);
  });

  it("after moving out, an earlier \"I found a place\" no longer counts", async () => {
    const s = await seeker(200);
    await prisma.user.update({ where: { id: s.user.id }, data: { foundHomeAt: daysAgo(150) } });
    const apt = await createApartment(s.user.id);
    await prisma.apartmentMember.updateMany({ where: { apartmentId: apt.id, userId: s.user.id }, data: { status: "MOVED_OUT", movedOutAt: daysAgo(20) } });

    const profile = await (await me(request("/api/auth/me", { token: s.token }))).json();
    expect(profile.housingState).toBe("HOME_SEEKER");
    expect(profile.foundHomeAt).toBeNull();
    expect(await ask(s.token)).toBe(true); // 20 days into the new search
  });
});

describe("the daily job", () => {
  it("needs the cron secret", async () => {
    const run = (secret?: string) => cronRoute(request("/api/cron/home-search", { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} }));
    expect((await run()).status).toBe(401);
    expect((await run("wrong")).status).toBe(401);
  });

  it("can count who would be asked without asking (before turning the job on)", async () => {
    const due = await createUser();
    await prisma.user.update({ where: { id: due.user.id }, data: { createdAt: at("2027-03-01T10:00:00Z") } });
    const now = at("2027-03-15T11:00:00Z");
    expect(await runHomeQuestion(now, { onlyUsers: [due.user.id], dryRun: true })).toEqual({ asked: 1, emailed: 0 });
    expect(emailsTo(due.user.email)).toHaveLength(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: due.user.id } })).homeAskedAt).toBeNull();
  });

  it("asks by email and push once due, then not again for 14 days", async () => {
    const due = await createUser();
    const notYet = await createUser();
    await prisma.user.update({ where: { id: due.user.id }, data: { createdAt: at("2027-03-01T10:00:00Z") } });
    await prisma.user.update({ where: { id: notYet.user.id }, data: { createdAt: at("2027-03-10T10:00:00Z") } });
    const onlyUsers = [due.user.id, notYet.user.id];

    expect(await runHomeQuestion(at("2027-03-15T11:00:00Z"), { onlyUsers })).toEqual({ asked: 1, emailed: 1 });
    expect(emailsTo(due.user.email)).toHaveLength(1);
    expect(emailsTo(due.user.email)[0].html).toContain("/?ask=home");
    expect(emailsTo(notYet.user.email)).toHaveLength(0);
    expect(pushed).toEqual([[due.user.id]]);

    expect(await runHomeQuestion(at("2027-03-16T11:00:00Z"), { onlyUsers })).toEqual({ asked: 0, emailed: 0 });
    expect(await runHomeQuestion(at("2027-03-24T11:00:00Z"), { onlyUsers })).toEqual({ asked: 1, emailed: 1 }); // notYet is due now
    expect(await runHomeQuestion(at("2027-03-29T11:00:00Z"), { onlyUsers })).toEqual({ asked: 1, emailed: 1 }); // 14 days on
    expect(emailsTo(due.user.email)).toHaveLength(2);
  });

  it("follows the person's settings, and skips people who answered", async () => {
    const quiet = await createUser();
    await prisma.user.update({
      where: { id: quiet.user.id },
      data: { createdAt: at("2027-03-01T10:00:00Z"), notifPrefs: JSON.stringify({ emailEnabled: false }) },
    });
    const looking = await createUser();
    await prisma.user.update({ where: { id: looking.user.id }, data: { createdAt: at("2027-03-01T10:00:00Z"), stillLookingAt: at("2027-03-14T10:00:00Z") } });
    const found = await createUser();
    await prisma.user.update({ where: { id: found.user.id }, data: { createdAt: at("2027-03-01T10:00:00Z"), foundHomeAt: at("2027-03-14T10:00:00Z") } });

    const result = await runHomeQuestion(at("2027-03-15T11:00:00Z"), { onlyUsers: [quiet.user.id, looking.user.id, found.user.id] });
    expect(result).toEqual({ asked: 1, emailed: 0 });
    expect(emailsTo(quiet.user.email)).toHaveLength(0);
    expect(pushed).toEqual([[quiet.user.id]]); // push still allowed
  });

  it("tries again the next day when email was the only way and it failed", async () => {
    const p = await createUser();
    await prisma.user.update({
      where: { id: p.user.id },
      data: { createdAt: at("2027-03-01T10:00:00Z"), notifPrefs: JSON.stringify({ pushEnabled: false }) },
    });
    vi.mocked(sendEmail).mockResolvedValueOnce(false);
    expect(await runHomeQuestion(at("2027-03-15T11:00:00Z"), { onlyUsers: [p.user.id] })).toEqual({ asked: 1, emailed: 0 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: p.user.id } })).homeAskedAt).toBeNull();
    expect(await runHomeQuestion(at("2027-03-16T11:00:00Z"), { onlyUsers: [p.user.id] })).toEqual({ asked: 1, emailed: 1 });
    expect(emailsTo(p.user.email)).toHaveLength(1);
  });

  it("sends several emails one after another, with a pause for the email service", async () => {
    const a = await createUser();
    const b = await createUser();
    for (const u of [a, b]) await prisma.user.update({ where: { id: u.user.id }, data: { createdAt: at("2027-03-01T10:00:00Z") } });
    const started = Date.now();
    expect(await runHomeQuestion(at("2027-03-15T11:00:00Z"), { onlyUsers: [a.user.id, b.user.id] })).toEqual({ asked: 2, emailed: 2 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(500);
  });
});
