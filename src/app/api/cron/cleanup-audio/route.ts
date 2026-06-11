import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const [expiredChat, expiredDMs] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { type: "AUDIO", createdAt: { lt: cutoff }, NOT: { content: "" } },
      select: { id: true, content: true },
    }),
    prisma.directMessage.findMany({
      where: { type: "AUDIO", createdAt: { lt: cutoff }, NOT: { content: "" } },
      select: { id: true, content: true },
    }),
  ]);

  const all = [...expiredChat, ...expiredDMs];

  // Delete files from disk
  await Promise.all(all.map(async msg => {
    try {
      const filename = msg.content.split("/").pop();
      if (filename) await unlink(join(process.cwd(), "public", "uploads", "audio", filename));
    } catch {
      // File already gone — safe to ignore
    }
  }));

  // Clear content so VoiceMessage renders the expired state
  await Promise.all([
    expiredChat.length > 0 && prisma.chatMessage.updateMany({
      where: { id: { in: expiredChat.map(m => m.id) } },
      data: { content: "" },
    }),
    expiredDMs.length > 0 && prisma.directMessage.updateMany({
      where: { id: { in: expiredDMs.map(m => m.id) } },
      data: { content: "" },
    }),
  ]);

  return NextResponse.json({ deleted: all.length });
}
