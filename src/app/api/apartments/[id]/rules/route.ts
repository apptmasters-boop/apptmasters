import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken, getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createFeedItem } from "@/lib/feed";
import { notifyApartment } from "@/lib/notify";

const schema = z.object({ content: z.string().min(1), propose: z.boolean().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId } = await params;

  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Admins can add directly; others propose (goes to vote)
  const isAdmin = membership.role === "ADMIN";
  const isProposal = parsed.data.propose || !isAdmin;

  const lastRule = await prisma.houseRule.findFirst({
    where: { apartmentId, status: { not: "ARCHIVED" } },
    orderBy: { version: "desc" },
  });

  const votingEndsAt = isProposal ? new Date(Date.now() + 48 * 60 * 60 * 1000) : null;

  const rule = await prisma.houseRule.create({
    data: {
      content: parsed.data.content,
      apartmentId,
      version: (lastRule?.version ?? 0) + 1,
      status: isProposal ? "PROPOSED" : "ACTIVE",
      votingEndsAt,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });

  await createFeedItem({
    apartmentId,
    userId: payload.userId,
    type: "RULE_ADDED",
    title: isProposal ? `${user?.name} proposed a new rule` : `New house rule added`,
    body: parsed.data.content,
    link: `/apartment/${apartmentId}`,
  });

  await notifyApartment(
    apartmentId,
    payload.userId,
    "RULE_ADDED",
    isProposal ? "New rule proposed" : "House rule added",
    isProposal
      ? `${user?.name} proposed: "${parsed.data.content}". Vote before ${votingEndsAt?.toLocaleDateString()}.`
      : `"${parsed.data.content}" was added to house rules.`,
    `/apartment/${apartmentId}`,
  );

  return NextResponse.json(rule, { status: 201 });
}
