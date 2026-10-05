import { Resend } from "resend";

// Created on first send, not at import: the Resend constructor throws without an
// API key, which used to crash `next build` anywhere email is not configured.
let resend: Resend | null = null;
const from = process.env.RESEND_FROM ?? "ApptMasters <noreply@apptmasters.com>";
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export { appUrl };

/**
 * Escapes text for the HTML email templates below. Names, apartment names and
 * notification text are typed by users; inserted raw, someone could sign up with
 * another person's email and a "name" containing links or markup, and that
 * person would receive it from our real address (phishing).
 * Every user-supplied value in a template must go through esc().
 */
const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, c => ESCAPES[c]);
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith("re_your_")) {
    console.warn(`[email] Resend not configured — skipping email to ${to}: ${subject}`);
    return;
  }
  resend ??= new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from, to, subject, html });
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">Reset your password</h2>
      <p style="color:#374151">Hi ${esc(name)},</p>
      <p style="color:#374151">Click the button below to reset your ApptMasters password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        Reset password
      </a>
      <p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function inviteEmail(inviterName: string, apartmentName: string, inviteUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">You've been invited!</h2>
      <p style="color:#374151"><strong>${esc(inviterName)}</strong> has invited you to join <strong>${esc(apartmentName)}</strong> on ApptMasters.</p>
      <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        Accept invitation
      </a>
      <p style="color:#6b7280;font-size:13px">This link takes you directly to the apartment — create an account or sign in to join.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function verificationEmail(name: string, verifyUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#1d5c4b;margin-bottom:8px">Confirm your email</h2>
      <p style="color:#374151">Hi ${esc(name)},</p>
      <p style="color:#374151">Thanks for signing up for Apartment Masters! Click the button below to confirm your email address and finish creating your account. This link expires in <strong>24 hours</strong>.</p>
      <a href="${esc(verifyUrl)}" style="display:inline-block;margin:24px 0;background:#1d5c4b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        Confirm my email
      </a>
      <p style="color:#6b7280;font-size:13px">If you didn't create an account, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function landlordInviteEmail(buildingName: string, unitNumber: string, inviteUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">Your unit is ready!</h2>
      <p style="color:#374151">You've been invited to move into <strong>Unit ${esc(unitNumber)}</strong> at <strong>${esc(buildingName)}</strong> on ApptMasters.</p>
      <p style="color:#374151">Click the button below to create your account and access your apartment portal.</p>
      <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        Accept invitation
      </a>
      <p style="color:#6b7280;font-size:13px">This link expires in 7 days. If you weren't expecting this invite, you can safely ignore it.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function deleteConfirmEmail(adminName: string, apartmentName: string, code: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#dc2626;margin-bottom:8px">Confirm apartment deletion</h2>
      <p style="color:#374151">Hi ${esc(adminName)},</p>
      <p style="color:#374151">You requested to permanently delete <strong>${esc(apartmentName)}</strong> from ApptMasters. This action cannot be undone.</p>
      <div style="margin:24px 0;text-align:center">
        <p style="color:#6b7280;font-size:13px;margin-bottom:8px">Your confirmation code (expires in 10 minutes):</p>
        <div style="display:inline-block;background:#fee2e2;border:1px solid #fca5a5;border-radius:12px;padding:16px 32px">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#dc2626;font-family:monospace">${esc(code)}</span>
        </div>
      </div>
      <p style="color:#6b7280;font-size:13px">If you did not request this, your account may be compromised. Contact support immediately.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function joinRequestEmail(requesterName: string, apartmentName: string, actionUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">New join request</h2>
      <p style="color:#374151"><strong>${esc(requesterName)}</strong> has requested to join <strong>${esc(apartmentName)}</strong>.</p>
      <p style="color:#374151">They are waiting for your approval before they can access the apartment.</p>
      <a href="${actionUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        Review request
      </a>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function joinApprovedEmail(userName: string, apartmentName: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">You're in!</h2>
      <p style="color:#374151">Hi ${esc(userName)},</p>
      <p style="color:#374151">Your request to join <strong>${esc(apartmentName)}</strong> has been approved. Log in to ApptMasters to access your apartment.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function notificationEmail(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">${esc(title)}</h2>
      <p style="color:#374151">${esc(body)}</p>
      ${actionUrl ? `
      <a href="${actionUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        ${esc(actionLabel ?? "View")}
      </a>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}
