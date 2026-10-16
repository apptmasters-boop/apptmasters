import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApartmentMember } from "@/lib/access";
import { raiseIssue, visibleTo, currentStep, IssueError } from "@/lib/issues";

/** More → Household issues (PRODUCT_LOGIC §18): the issues this person can see, each with its timeline. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const [issues, members] = await Promise.all([
    prisma.dispute.findMany({
      where: visibleTo(apartmentId, access.userId, access.membership.role),
      include: {
        raisedBy: { select: { id: true, name: true } },
        against: { select: { id: true, name: true } },
        comments: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // For "who it involves" when raising one.
    prisma.apartmentMember.findMany({
      where: { apartmentId, status: { in: ["ACTIVE", "VACATION"] }, userId: { not: access.userId } },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return NextResponse.json({
    me: access.userId,
    isAdmin: access.membership.role === "ADMIN",
    people: members.map(m => m.user),
    issues: issues.map(i => ({ ...i, status: currentStep(i.status) })),
  });
}

/** POST { title, description, category, againstId?, isPrivate? }: raise an issue. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const body = await req.json().catch(() => ({}));
  try {
    const issue = await raiseIssue(apartmentId, access.userId, {
      title: String(body.title ?? ""), description: String(body.description ?? ""), category: String(body.category ?? "OTHER"),
      againstId: typeof body.againstId === "string" && body.againstId ? body.againstId : null, isPrivate: body.isPrivate === true,
    });
    return NextResponse.json(issue, { status: 201 });
  } catch (e) {
    if (e instanceof IssueError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
