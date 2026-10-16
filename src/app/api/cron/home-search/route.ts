import { NextRequest, NextResponse } from "next/server";
import { runHomeQuestion } from "@/lib/homeSearch";

/**
 * Daily "Have you found your new home?" job (server crontab): asks the people
 * whose question is due, by email and push, never more than once in 14 days.
 * The rules are in src/lib/housing.ts and src/lib/homeSearch.ts.
 * `?dryRun=1` only counts who would be asked (used before enabling the job).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  return NextResponse.json({ dryRun, ...(await runHomeQuestion(new Date(), { dryRun })) });
}
