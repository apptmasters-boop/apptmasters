/**
 * Shared builders for API tests: create users/apartments straight in the
 * database and build requests the way the browser client does
 * (JSON body + "Authorization: Bearer <token>").
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signToken } from "@/lib/auth";

export const TEST_PASSWORD = "Correct-Horse-9";

export async function createUser(opts: { emailVerified?: boolean; systemRole?: string } = {}) {
  const email = `user-${randomUUID()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "Test User",
      email,
      password: await bcrypt.hash(TEST_PASSWORD, 4), // low cost: speed over strength in tests
      emailVerified: opts.emailVerified ?? true,
      systemRole: opts.systemRole ?? "USER",
    },
  });
  return { user, token: signToken({ userId: user.id, email: user.email }) };
}

/** Creates an apartment with `member` as its only (ADMIN) member. */
export async function createApartment(memberId: string) {
  return prisma.apartment.create({
    data: {
      name: "Test Apartment",
      inviteCode: randomUUID().slice(0, 8),
      members: { create: { userId: memberId, role: "ADMIN" } },
    },
  });
}

export function request(path: string, opts: { method?: string; token?: string; body?: unknown; ip?: string } = {}) {
  const headers: Record<string, string> = {
    // Unique per request so IP rate limits don't leak between tests
    "x-forwarded-for": opts.ip ?? `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

/** The second argument Next passes to dynamic route handlers. */
export const routeParams = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
