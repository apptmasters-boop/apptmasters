import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { homeQuestionFor, answerHomeQuestion } from "@/lib/homeSearch";

/** Should the Listings card ask "Have you found your new home?" now? (Sprint 11a) */
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await homeQuestionFor(payload.userId));
}

const schema = z.object({ answer: z.enum(["LOOKING", "FOUND"]) });

/** The answer: "I'm still looking" or "Yes, I found a place" (then `next` says where to go). */
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const result = await answerHomeQuestion(payload.userId, parsed.data.answer);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
