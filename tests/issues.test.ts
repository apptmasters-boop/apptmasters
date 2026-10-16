/**
 * Sprint 10a: Household issues (PRODUCT_LOGIC §18), replacing disputes.
 * Open → Discussion → Proposed resolution → Resolved; the person who raised it
 * accepts; private issues are seen only by the raiser, the person involved and
 * household admins (owner's decisions, 2026-10-15).
 */
import { describe, it, expect } from "vitest";
import { GET as listRoute, POST as raiseRoute } from "@/app/api/apartments/[id]/issues/route";
import { POST as actRoute } from "@/app/api/apartments/[id]/issues/[issueId]/route";
import { buildHomeFeed } from "@/lib/homeFeed";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

/** Admin (household admin), Ana (raises issues), Ben (involved), Cleo (another roommate). */
async function household() {
  const admin = await createUser();
  const ana = await createUser();
  const ben = await createUser();
  const cleo = await createUser();
  const apt = await createApartment(admin.user.id);
  await prisma.apartmentMember.createMany({ data: [ana, ben, cleo].map(p => ({ apartmentId: apt.id, userId: p.user.id })) });
  return { admin, ana, ben, cleo, apt };
}
const raise = (token: string, aptId: string, body: object) =>
  raiseRoute(request("/x", { method: "POST", token, body }), routeParams({ id: aptId }));
const list = async (token: string, aptId: string) =>
  (await listRoute(request("/x", { token }), routeParams({ id: aptId }))).json();
const act = (token: string, aptId: string, issueId: string, action: string, text?: string) =>
  actRoute(request("/x", { method: "POST", token, body: { action, text } }), routeParams({ id: aptId, issueId }));
const noise = { category: "NOISE", title: "Music late at night", description: "It's loud after midnight on weekdays." };

describe("raising an issue", () => {
  it("records the topic and who it involves, and tells that person and the others", async () => {
    const { admin, ana, ben, cleo, apt } = await household();
    expect((await raise(ana.token, apt.id, { ...noise, category: "WAR" })).status).toBe(400);
    expect((await raise(ana.token, apt.id, { ...noise, againstId: ana.user.id })).status).toBe(400); // not yourself
    const outsider = await createUser();
    expect((await raise(ana.token, apt.id, { ...noise, againstId: outsider.user.id })).status).toBe(400);

    const res = await raise(ana.token, apt.id, { ...noise, againstId: ben.user.id });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ status: "OPEN", category: "NOISE", againstId: ben.user.id, isPrivate: false });

    const told = (userId: string) => prisma.notification.findFirst({ where: { userId, type: "ISSUE_RAISED", apartmentId: apt.id } });
    expect((await told(ben.user.id))?.title).toMatch(/raised a household issue with you$/);
    expect((await told(cleo.user.id))?.title).toBe("New household issue: Music late at night");
    expect(await told(admin.user.id)).toBeTruthy();
    expect(await told(ana.user.id)).toBeNull();
  });
});

describe("the steps", () => {
  it("reply → discussion, propose → proposed; the raiser declines (with a reason) or accepts → resolved", async () => {
    const { ana, ben, cleo, apt } = await household();
    const issue = await (await raise(ana.token, apt.id, { ...noise, againstId: ben.user.id })).json();

    expect((await act(ben.token, apt.id, issue.id, "reply", "Sorry, I didn't know.")).status).toBe(200);
    expect((await list(cleo.token, apt.id)).issues[0].status).toBe("DISCUSSION");

    expect((await act(ben.token, apt.id, issue.id, "propose", "Headphones after 10 pm")).status).toBe(200);
    expect((await act(cleo.token, apt.id, issue.id, "propose", "Something else")).status).toBe(409); // one at a time
    expect((await buildHomeFeed(apt.id, ana.user.id, "MEMBER")).find(i => i.id === `issue-proposal:${issue.id}`)?.title).toBe("Proposed resolution: Music late at night");

    expect((await act(ben.token, apt.id, issue.id, "accept")).status).toBe(403); // only the raiser
    expect((await act(ana.token, apt.id, issue.id, "decline")).status).toBe(400); // needs a reason
    expect((await act(ana.token, apt.id, issue.id, "decline", "I study late too")).status).toBe(200);
    expect((await list(ana.token, apt.id)).issues[0]).toMatchObject({ status: "DISCUSSION", proposal: null });

    await act(ben.token, apt.id, issue.id, "propose", "Headphones after midnight");
    expect((await act(ana.token, apt.id, issue.id, "accept")).status).toBe(200);
    const done = (await list(cleo.token, apt.id)).issues[0];
    expect(done).toMatchObject({ status: "RESOLVED", resolution: "Headphones after midnight" });
    expect(done.comments.map((c: { kind: string }) => c.kind)).toEqual(["COMMENT", "PROPOSAL", "DECLINED", "PROPOSAL", "ACCEPTED"]);
    expect(await prisma.notification.count({ where: { userId: cleo.user.id, title: "Resolved: Music late at night" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { apartmentId: apt.id, action: "ISSUE_RESOLVED" } })).toBe(1);

    expect((await act(ben.token, apt.id, issue.id, "reply", "Thanks!")).status).toBe(409); // settled
    expect((await buildHomeFeed(apt.id, ana.user.id, "MEMBER")).some(i => i.id.startsWith("issue-proposal:"))).toBe(false);
  });

  it("the raiser or an admin can close a stuck issue; others can't", async () => {
    const { admin, ana, cleo, apt } = await household();
    const first = await (await raise(ana.token, apt.id, noise)).json();
    expect((await act(cleo.token, apt.id, first.id, "close")).status).toBe(403);
    expect((await act(ana.token, apt.id, first.id, "close", "Sorted it out in person")).status).toBe(200);
    const second = await (await raise(ana.token, apt.id, { ...noise, title: "Dishes" })).json();
    expect((await act(admin.token, apt.id, second.id, "close")).status).toBe(200);
    const statuses = (await list(ana.token, apt.id)).issues.map((i: { status: string }) => i.status);
    expect(statuses).toEqual(["CLOSED", "CLOSED"]);
  });
});

describe("private issues", () => {
  it("are seen only by the raiser, the person involved and household admins", async () => {
    const { admin, ana, ben, cleo, apt } = await household();
    const issue = await (await raise(ana.token, apt.id, { ...noise, againstId: ben.user.id, isPrivate: true })).json();
    const sees = async (token: string) => (await list(token, apt.id)).issues.some((i: { id: string }) => i.id === issue.id);
    expect(await sees(ana.token)).toBe(true);
    expect(await sees(ben.token)).toBe(true);
    expect(await sees(admin.token)).toBe(true);
    expect(await sees(cleo.token)).toBe(false);
    expect((await act(cleo.token, apt.id, issue.id, "reply", "Hi")).status).toBe(404);
    expect(await prisma.notification.count({ where: { userId: cleo.user.id, apartmentId: apt.id, type: "ISSUE_RAISED" } })).toBe(0);
  });
});

describe("issues saved as disputes", () => {
  it("dismissed ones show as closed", async () => {
    const { ana, apt } = await household();
    await prisma.dispute.create({ data: { apartmentId: apt.id, raisedById: ana.user.id, title: "Old", description: "From before", status: "DISMISSED" } });
    expect((await list(ana.token, apt.id)).issues[0].status).toBe("CLOSED");
  });
});
