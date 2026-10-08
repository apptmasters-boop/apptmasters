import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * The JWT signing secret. There is deliberately no fallback in production: a
 * default string would be public (it is in this repo), and anyone could forge
 * a login for any user. Read lazily so `next build` works without it.
 */
function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET is not set");
  return "apptmasters-dev-secret"; // local development only
}

// Two-factor challenges are signed with a different key, so a challenge can
// never be used as a login token (and vice versa).
const challengeSecret = () => `${jwtSecret()}:2fa-challenge`;

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, jwtSecret()) as JwtPayload;
}

/** Proof that the password step passed; exchanged for a login token at /api/auth/2fa/verify. */
export function signTwoFactorChallenge(userId: string): string {
  return jwt.sign({ userId }, challengeSecret(), { expiresIn: "10m" });
}

/** Returns the userId from a valid, unexpired challenge, or null. */
export function verifyTwoFactorChallenge(challenge: string): string | null {
  try {
    const { userId } = jwt.verify(challenge, challengeSecret()) as { userId?: string };
    return userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Stream tickets let the browser open a live (EventSource) connection without
 * putting the login token in the URL. EventSource can't send headers, so the
 * ticket has to travel in the query string, where it lands in server logs.
 * A ticket is therefore short-lived (60 s, checked only when the stream opens)
 * and signed with its own key, so it can never be used as a login token.
 * Clients get one from POST /api/stream-ticket; see src/lib/liveStream.ts.
 */
const streamSecret = () => `${jwtSecret()}:stream-ticket`;

export function signStreamTicket(payload: JwtPayload): string {
  return jwt.sign({ userId: payload.userId, email: payload.email }, streamSecret(), { expiresIn: "60s" });
}

/** The user behind the `?ticket=` of a stream request, or null if missing/invalid/expired. */
export function getStreamUser(req: NextRequest): JwtPayload | null {
  const ticket = req.nextUrl.searchParams.get("ticket");
  if (!ticket) return null;
  try {
    const { userId, email } = jwt.verify(ticket, streamSecret()) as Partial<JwtPayload>;
    return userId && email ? { userId, email } : null;
  } catch {
    return null;
  }
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
