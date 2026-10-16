import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, joinRequestEmail, appUrl } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { moveInDaySchema, moveInDay } from "@/lib/away";

/**
 * Join a Home (Home Setup, Sprint 11b; MARKETPLACE_FLOW.md §23): with the
 * invite code a household admin shared, preview the home, then ask to join.
 * Access waits for an admin's approval (PENDING_APPROVAL until then).
 */

// Codes are short, so tries are limited per person (shared by preview and request).
const TRIES = 20;
const TRIES_WINDOW_MS = 10 * 60_000;
const tooMany = () => NextResponse.json({ error: "Too many tries. Please wait a few minutes." }, { status: 429 });
const notFound = () => NextResponse.json({ error: "No home has this code. Check it with your roommate." }, { status: 404 });

const homeByCode = (code: string) => prisma.apartment.findUnique({
  where: { inviteCode: code.trim().toUpperCase() },
  select: { id: true, name: true, address: true, _count: { select: { members: { where: { status: { in: ["ACTIVE", "VACATION"] } } } } } },
});

/** Preview: the home's name, address and how many people live there, before asking to join. */
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`join:${payload.userId}`, TRIES, TRIES_WINDOW_MS).ok) return tooMany();

  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!code.trim()) return NextResponse.json({ error: "Enter the invite code" }, { status: 400 });
  const home = await homeByCode(code);
  if (!home) return notFound();

  const mine = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId: home.id } },
    select: { status: true },
  });
  return NextResponse.json({
    name: home.name,
    address: home.address,
    members: home._count.members,
    // Already in this home (or waiting): the page says so instead of asking again.
    myStatus: mine?.status ?? null,
    apartmentId: mine && mine.status !== "PENDING_APPROVAL" ? home.id : null,
  });
}

const schema = z.object({
  inviteCode: z.string().min(1),
  role: z.enum(["MEMBER", "GUEST"]).optional().default("MEMBER"),
  /** Their move-in day; until then they count like someone away. */
  moveInDate: moveInDaySchema.optional(),
});

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`join:${payload.userId}`, TRIES, TRIES_WINDOW_MS).ok) return tooMany();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const apartment = await homeByCode(parsed.data.inviteCode);
  if (!apartment) return notFound();

  const existing = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId: apartment.id } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  // Create member in PENDING_APPROVAL state — apartment admin must approve before access is granted
  await prisma.apartmentMember.create({
    data: {
      userId: payload.userId, apartmentId: apartment.id, role: parsed.data.role, status: "PENDING_APPROVAL",
      moveInDate: parsed.data.moveInDate ? moveInDay(parsed.data.moveInDate) : null,
    },
  });

  // Email all active apartment admins about the new join request
  const requester = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
  const admins = await prisma.apartmentMember.findMany({
    where: { apartmentId: apartment.id, role: "ADMIN", status: "ACTIVE" },
    include: { user: { select: { email: true } } },
  });
  const reviewUrl = `${appUrl}/apartment/${apartment.id}`;
  await Promise.allSettled(
    admins.map(a =>
      sendEmail(
        a.user.email,
        `${requester?.name ?? "Someone"} wants to join ${apartment.name}`,
        joinRequestEmail(requester?.name ?? "Someone", apartment.name, reviewUrl)
      )
    )
  );

  return NextResponse.json({ pending: true, apartmentId: apartment.id, apartmentName: apartment.name }, { status: 201 });
}
