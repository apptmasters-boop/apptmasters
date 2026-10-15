import { NextRequest, NextResponse } from "next/server";
import { runRentAutomation } from "@/lib/rent";

/**
 * Daily rent job (server crontab, 09:00): starts each month's rent 3 days
 * before it's due and sends the due-day and late reminders. The rules are in
 * src/lib/rent.ts (runRentAutomation).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runRentAutomation(new Date()));
}
