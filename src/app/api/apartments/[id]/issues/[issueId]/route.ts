import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { actOnIssue, IssueError } from "@/lib/issues";

/**
 * POST { action: reply | propose | accept | decline | close, text? }: the next
 * step on a household issue (rules in src/lib/issues.ts).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; issueId: string }> }) {
  const { id: apartmentId, issueId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  // Only issues of this home (a private one someone can't see answers "not found" too).
  const exists = await prisma.dispute.findFirst({ where: { id: issueId, apartmentId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  try {
    const issue = await actOnIssue(issueId, { userId: access.userId, memberRole: access.membership.role }, String(body.action ?? ""), typeof body.text === "string" ? body.text : null);
    return NextResponse.json(issue);
  } catch (e) {
    if (e instanceof IssueError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
