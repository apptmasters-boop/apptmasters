/**
 * Email confirmation links. A new account cannot sign in until its owner
 * clicks the link (login refuses users with emailVerified = false), so an
 * account is only usable by whoever controls the inbox.
 *
 * Flow: POST /api/listings/signup creates the unverified user and calls
 * sendVerificationLink → user clicks /verify-email?token=… → POST
 * /api/auth/verify-email marks them verified and signs them in.
 * POST /api/auth/resend-verification sends a fresh link.
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, verificationEmail, appUrl } from "@/lib/email";
import { safeReturnTo } from "@/lib/returnTo";

const LINK_TTL_MS = 24 * 60 * 60 * 1000;

export async function sendVerificationLink(user: { id: string; name: string; email: string }, returnTo?: string | null) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: { token, expiresAt: new Date(Date.now() + LINK_TTL_MS), userId: user.id },
  });

  const url = new URL("/verify-email", appUrl);
  url.searchParams.set("token", token);
  const next = safeReturnTo(returnTo, "");
  if (next) url.searchParams.set("returnTo", next);

  // The local copy sends no email: print the link so sign-up can be tested there
  // (scripts/dev/screenshots/confirm-link.mjs finds it). Never on the live site.
  const emailOff = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith("re_your_");
  if (process.env.NODE_ENV !== "production" && emailOff) console.info(`[email] confirmation link for ${user.email}: ${url}`);

  await sendEmail(user.email, "Confirm your ApptMasters email", verificationEmail(user.name, url.toString()));
}
