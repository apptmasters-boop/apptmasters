/**
 * Email-based two-factor sign-in.
 *
 * Flow (enforced on the server, not just in the login page):
 *   1. POST /api/auth/login with email + password. For a 2FA account this
 *      returns { twoFactorRequired, challenge } and emails a code. It does NOT
 *      return a login token.
 *   2. POST /api/auth/2fa/verify with { challenge, code } returns the token.
 *   POST /api/auth/2fa/send with { challenge } re-sends a code.
 */
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail, esc } from "@/lib/email";

const CODE_TTL_MS = 10 * 60 * 1000;

/** 2FA is skipped when email is not configured, since the code could not be delivered. */
export const isEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY) && !process.env.RESEND_API_KEY!.startsWith("re_your_");

/** Should this user be asked for a code after their password? */
export const requiresTwoFactor = (user: { twoFactorEnabled: boolean }) => user.twoFactorEnabled && isEmailConfigured();

/** Creates a fresh 6-digit code and emails it. Uses a cryptographic RNG: codes must not be predictable. */
export async function sendLoginCode(user: { id: string; name: string; email: string }) {
  const code = String(randomInt(100000, 1000000));
  await prisma.twoFactorCode.create({
    data: { userId: user.id, code, expiresAt: new Date(Date.now() + CODE_TTL_MS) },
  });
  await sendEmail(
    user.email,
    "Your ApptMasters login code",
    `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5">Your login code</h2>
      <p style="color:#374151">Hi ${esc(user.name)},</p>
      <p style="color:#374151">Use this code to sign in. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111827;background:#f3f4f6;padding:20px 24px;border-radius:8px;text-align:center;margin:24px 0">${code}</div>
      <p style="color:#6b7280;font-size:13px">If you didn't try to sign in, ignore this email.</p>
    </div>`,
  );
}
