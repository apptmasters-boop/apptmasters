import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Deletes sign-ups whose email was never confirmed (they could never sign in).
// Without this, an address someone typed by mistake or in bad faith stays
// reserved forever. Run daily by the server's crontab with x-cron-secret.
//
// Deliberately conservative: only plain users, older than the grace period,
// with nothing attached (no household, listings or managed property).
const GRACE_DAYS = 7;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.user.deleteMany({
    where: {
      emailVerified: false,
      systemRole: "USER",
      createdAt: { lt: cutoff },
      memberships: { none: {} },
      listings: { none: {} },
      managedApartments: { none: {} },
      managedBuildings: { none: {} },
    },
  });

  return NextResponse.json({ deleted: count });
}
