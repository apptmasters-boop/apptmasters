import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET ?? "apptmasters-dev-secret";

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function getTokenFromRequest(req: NextRequest): JwtPayload | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    return verifyToken(auth.slice(7));
  } catch {
    return null;
  }
}

export async function requireSuperAdmin(req: NextRequest): Promise<JwtPayload | null> {
  const payload = getTokenFromRequest(req);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { systemRole: true } });
  return user?.systemRole === "SUPER_ADMIN" ? payload : null;
}

export async function requireManager(req: NextRequest): Promise<JwtPayload | null> {
  const payload = getTokenFromRequest(req);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { systemRole: true } });
  return user?.systemRole === "MANAGER" || user?.systemRole === "SUPER_ADMIN" ? payload : null;
}
