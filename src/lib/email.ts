import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.RESEND_FROM ?? "ApptMasters <noreply@apptmasters.com>";
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

export { appUrl };

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith("re_your_")) {
    console.warn(`[email] Resend not configured — skipping email to ${to}: ${subject}`);
    return;
  }
  await resend.emails.send({ from, to, subject, html });
}

export function passwordResetEmail(name: string, resetUrl: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">Reset your password</h2>
      <p style="color:#374151">Hi ${name},</p>
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
      <p style="color:#374151"><strong>${inviterName}</strong> has invited you to join <strong>${apartmentName}</strong> on ApptMasters.</p>
      <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        Accept invitation
      </a>
      <p style="color:#6b7280;font-size:13px">This link takes you directly to the apartment — create an account or sign in to join.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}

export function notificationEmail(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="color:#4f46e5;margin-bottom:8px">${title}</h2>
      <p style="color:#374151">${body}</p>
      ${actionUrl ? `
      <a href="${actionUrl}" style="display:inline-block;margin:24px 0;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">
        ${actionLabel ?? "View"}
      </a>` : ""}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px">ApptMasters — Roommate management made simple</p>
    </div>
  `;
}
