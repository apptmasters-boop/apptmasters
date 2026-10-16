import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail, notificationEmail } from "@/lib/email";

// The nightly backup (scripts/ops/backup.sh, docs/BACKUPS.md) calls this when
// it fails, with x-cron-secret; the site admins get an email saying which step
// stopped. A successful night needs nothing (it's in the server's backup log).
const bodySchema = z.object({
  ok: z.boolean(),
  step: z.string().max(100).optional(),
  day: z.string().max(20).optional(),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  if (parsed.data.ok) return NextResponse.json({ emailed: 0 });

  const { step, day } = parsed.data;
  const title = "Nightly backup failed";
  const body = `The backup of ${day ?? "last night"} stopped at: ${step ?? "an unknown step"}. ` +
    "The site still works; the last good backup is the one before. Details are in ~/backups/nightly/backup.log on the server (docs/BACKUPS.md).";
  const admins = await prisma.user.findMany({ where: { systemRole: "SUPER_ADMIN" }, select: { email: true } });
  let emailed = 0;
  for (const { email } of admins) {
    if (await sendEmail(email, title, notificationEmail(title, body)).catch(() => false)) emailed++;
  }
  return NextResponse.json({ emailed });
}
