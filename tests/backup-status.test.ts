/**
 * Pre-launch P1: when the nightly backup fails (scripts/ops/backup.sh), the
 * site admins get an email. Only the server, with the cron secret, can report.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { POST as backupStatus } from "@/app/api/cron/backup-status/route";
import { createUser, request } from "./helpers";

const SECRET = "test-cron-secret";
beforeAll(() => { process.env.CRON_SECRET = SECRET; });

const sentEmails = () => (globalThis as unknown as { sentEmails: { to: string; subject: string; html: string }[] }).sentEmails;
const report = (body: unknown, secret?: string) =>
  backupStatus(request("/api/cron/backup-status", { method: "POST", body, headers: secret ? { "x-cron-secret": secret } : {} }));

describe("POST /api/cron/backup-status", () => {
  it("needs the cron secret", async () => {
    expect((await report({ ok: false, step: "database dump" })).status).toBe(401);
    expect((await report({ ok: false, step: "database dump" }, "wrong")).status).toBe(401);
  });

  it("emails the site admins when a night failed, and nobody when it worked", async () => {
    const admin = await createUser({ systemRole: "SUPER_ADMIN" });
    const member = await createUser();
    const toAdmin = () => sentEmails().filter(m => m.to === admin.user.email && m.subject === "Nightly backup failed");

    const ok = await report({ ok: true, day: "2026-10-17" }, SECRET);
    expect(await ok.json()).toEqual({ emailed: 0 });
    expect(toAdmin()).toHaveLength(0);

    const failed = await report({ ok: false, step: "copy to S3", day: "2026-10-17" }, SECRET);
    expect(failed.status).toBe(200);
    expect(toAdmin()).toHaveLength(1);
    expect(toAdmin()[0].html).toContain("copy to S3");
    expect(sentEmails().some(m => m.to === member.user.email && m.subject === "Nightly backup failed")).toBe(false);
  });

  it("refuses a report it can't read", async () => {
    expect((await report({ step: "x" }, SECRET)).status).toBe(400);
  });
});
