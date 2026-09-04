import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes 0/O and 1/I/L to avoid ambiguity
const CODE_COUNT = 8;

function generateCode(): string {
  let raw = "";
  for (let i = 0; i < 8; i++) raw += CHARSET[randomInt(CHARSET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const remaining = await prisma.backupCode.count({ where: { userId: payload.userId, used: false } });
  return NextResponse.json({ remaining });
}

// Generates a fresh set of backup codes, invalidating any previous unused ones.
// The plaintext codes are returned exactly once and never stored or retrievable again.
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const codes = Array.from({ length: CODE_COUNT }, generateCode);
  const hashes = await Promise.all(codes.map(c => bcrypt.hash(c, 10)));

  await prisma.$transaction([
    prisma.backupCode.deleteMany({ where: { userId: payload.userId } }),
    prisma.backupCode.createMany({
      data: hashes.map(codeHash => ({ userId: payload.userId, codeHash })),
    }),
  ]);

  return NextResponse.json({ codes });
}
