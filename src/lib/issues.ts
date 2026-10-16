/**
 * Household issues (docs/PRODUCT_LOGIC.md §18; "disputes" before Sprint 10a):
 *
 *   OPEN → DISCUSSION (first reply) → PROPOSED (someone suggests a resolution)
 *        → RESOLVED (the person who raised it accepts)
 *   A declined proposal goes back to DISCUSSION. The person who raised it, or a
 *   household admin, can CLOSE an issue that's stuck.
 *
 * Owner's decisions (2026-10-15): the person who raised it accepts proposals;
 * issues are visible to everyone at home unless marked private, in which case
 * only the raiser, the person it involves and household admins see it.
 * Stored as Dispute / DisputeComment; `againstId` is "who it involves".
 */
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { logAudit } from "@/lib/audit";

export const TOPICS = ["NOISE", "CLEANING", "EXPENSES", "RENT", "GUESTS", "OTHER"] as const;
export const TOPIC_LABEL: Record<string, string> = {
  NOISE: "Noise", CLEANING: "Cleaning", EXPENSES: "Shared expenses", RENT: "Rent", GUESTS: "Guests", OTHER: "Other",
};
export const STEP_LABEL: Record<string, string> = {
  OPEN: "Open", DISCUSSION: "Discussion", PROPOSED: "Proposed resolution", RESOLVED: "Resolved", CLOSED: "Closed",
};

/** Issues saved before Sprint 10a said "DISMISSED"; that's "CLOSED" now. */
export const currentStep = (status: string) => (status === "DISMISSED" ? "CLOSED" : status);
export const isOpenIssue = (status: string) => !["RESOLVED", "CLOSED"].includes(currentStep(status));

type IssueLike = { raisedById: string; againstId: string | null; isPrivate: boolean };

/** Can this person see the issue? Everyone at home, unless it's private. */
export const canSee = (issue: IssueLike, userId: string, memberRole: string | undefined) =>
  !issue.isPrivate || issue.raisedById === userId || issue.againstId === userId || memberRole === "ADMIN";

/** Prisma filter for the issues this person can see in a home. */
export const visibleTo = (apartmentId: string, userId: string, memberRole: string | undefined) =>
  memberRole === "ADMIN"
    ? { apartmentId }
    : { apartmentId, OR: [{ isPrivate: false }, { raisedById: userId }, { againstId: userId }] };

export class IssueError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** Everyone who can see the issue, except `except` (for "it's resolved" and similar). */
async function audience(apartmentId: string, issue: IssueLike, except: string) {
  const members = await prisma.apartmentMember.findMany({
    where: { apartmentId, status: { in: ["ACTIVE", "VACATION"] } },
    select: { userId: true, role: true },
  });
  return members.filter(m => m.userId !== except && canSee(issue, m.userId, m.role)).map(m => m.userId);
}

/** Raise an issue and tell the people who should know. */
export async function raiseIssue(apartmentId: string, userId: string, input: {
  title: string; description: string; category: string; againstId?: string | null; isPrivate?: boolean;
}) {
  const title = input.title.trim().slice(0, 120);
  const description = input.description.trim().slice(0, 2000);
  if (!title || !description) throw new IssueError("Add a title and say what's going on");
  if (!(TOPICS as readonly string[]).includes(input.category)) throw new IssueError("Choose a topic");
  let againstId: string | null = null;
  if (input.againstId) {
    const involved = await prisma.apartmentMember.findFirst({ where: { apartmentId, userId: input.againstId, status: { in: ["ACTIVE", "VACATION"] } } });
    if (!involved || input.againstId === userId) throw new IssueError("The person it involves must live here (and not be you)");
    againstId = input.againstId;
  }

  const issue = await prisma.dispute.create({
    data: { apartmentId, raisedById: userId, title, description, category: input.category, againstId, isPrivate: !!input.isPrivate },
    include: { raisedBy: { select: { name: true } } },
  });
  // The person it involves hears about it directly; others who can see it get a general note.
  if (againstId) {
    await notify({
      apartmentId, userIds: [againstId], sendEmailTo: [againstId], type: "ISSUE_RAISED", link: `/apartment/${apartmentId}/issues`,
      title: `${issue.raisedBy.name} raised a household issue with you`, body: `"${title}". Reply on Household issues.`,
    });
  }
  const others = (await audience(apartmentId, issue, userId)).filter(id => id !== againstId);
  await notify({
    apartmentId, userIds: others, type: "ISSUE_RAISED", link: `/apartment/${apartmentId}/issues`,
    title: `New household issue: ${title}`, body: `${issue.raisedBy.name} raised it (${TOPIC_LABEL[input.category]}).`,
  });
  return issue;
}

/**
 * The steps after raising. `reply` (anyone who can see it), `propose` (anyone,
 * with a resolution), `accept` / `decline` (the person who raised it; decline
 * needs a reason), `close` (the person who raised it or a household admin).
 */
export async function actOnIssue(issueId: string, user: { userId: string; memberRole?: string }, action: string, text?: string | null, now = new Date()) {
  const issue = await prisma.dispute.findUnique({ where: { id: issueId }, include: { raisedBy: { select: { name: true } } } });
  if (!issue || !canSee(issue, user.userId, user.memberRole)) throw new IssueError("Issue not found", 404);
  const step = currentStep(issue.status);
  const body = text?.trim().slice(0, 2000) || "";
  const isRaiser = issue.raisedById === user.userId;
  const link = `/apartment/${issue.apartmentId}/issues`;
  const me = (await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } }))?.name ?? "Someone";
  if (!isOpenIssue(step)) throw new IssueError("This issue is already settled", 409);

  // One change at a time: only if nobody moved the issue on meanwhile.
  const move = async (data: Record<string, unknown>, entry: { kind: string; body: string }) => {
    await prisma.$transaction(async tx => {
      const { count } = await tx.dispute.updateMany({ where: { id: issueId, status: issue.status }, data });
      if (count === 0) throw new IssueError("Someone changed this issue at the same time. Try again.", 409);
      await tx.disputeComment.create({ data: { disputeId: issueId, userId: user.userId, kind: entry.kind, body: entry.body } });
    });
  };
  const tell = async (userIds: string[], title: string, message: string) =>
    notify({ apartmentId: issue.apartmentId, userIds: userIds.filter(id => id !== user.userId), type: `ISSUE_${action.toUpperCase()}`, link, title, body: message });

  switch (action) {
    case "reply": {
      if (!body) throw new IssueError("Write a reply");
      await move(step === "OPEN" ? { status: "DISCUSSION" } : {}, { kind: "COMMENT", body });
      await tell([issue.raisedById, ...(issue.againstId ? [issue.againstId] : [])], `New reply: ${issue.title}`, `${me}: ${body.slice(0, 140)}`);
      break;
    }
    case "propose": {
      if (!body) throw new IssueError("Write the resolution you suggest");
      if (step === "PROPOSED") throw new IssueError("A resolution is already waiting for an answer", 409);
      await move({ status: "PROPOSED", proposal: body, proposedById: user.userId, proposedAt: now }, { kind: "PROPOSAL", body });
      await tell([issue.raisedById], `Proposed resolution: ${issue.title}`, `${me} suggests: "${body.slice(0, 140)}". Accept or decline.`);
      break;
    }
    case "accept": {
      if (!isRaiser) throw new IssueError("Only the person who raised the issue can accept a resolution", 403);
      if (step !== "PROPOSED") throw new IssueError("There's no resolution to accept", 409);
      await move({ status: "RESOLVED", resolution: issue.proposal, resolvedAt: now }, { kind: "ACCEPTED", body: issue.proposal ?? "" });
      await tell(await audience(issue.apartmentId, issue, user.userId), `Resolved: ${issue.title}`, `Agreed: "${(issue.proposal ?? "").slice(0, 140)}"`);
      logAudit({ action: "ISSUE_RESOLVED", entityType: "issue", entityId: issueId, meta: { title: issue.title, resolution: issue.proposal }, userId: user.userId, apartmentId: issue.apartmentId });
      break;
    }
    case "decline": {
      if (!isRaiser) throw new IssueError("Only the person who raised the issue can decline a resolution", 403);
      if (step !== "PROPOSED") throw new IssueError("There's no resolution to decline", 409);
      if (!body) throw new IssueError("Say why, so the discussion can go on");
      await move({ status: "DISCUSSION", proposal: null, proposedById: null, proposedAt: null }, { kind: "DECLINED", body });
      await tell(issue.proposedById ? [issue.proposedById] : [], `Not agreed yet: ${issue.title}`, `${me} declined the proposal: ${body.slice(0, 140)}`);
      break;
    }
    case "close": {
      if (!isRaiser && user.memberRole !== "ADMIN") throw new IssueError("Only the person who raised it or a household admin can close an issue", 403);
      await move({ status: "CLOSED", resolvedAt: now, proposal: null }, { kind: "CLOSED", body });
      await tell([issue.raisedById, ...(issue.againstId ? [issue.againstId] : [])], `Closed: ${issue.title}`, body ? `${me}: ${body.slice(0, 140)}` : `${me} closed it.`);
      logAudit({ action: "ISSUE_CLOSED", entityType: "issue", entityId: issueId, meta: { title: issue.title, reason: body || null }, userId: user.userId, apartmentId: issue.apartmentId });
      break;
    }
    default:
      throw new IssueError("Unknown action");
  }
  return prisma.dispute.findUniqueOrThrow({ where: { id: issueId } });
}
