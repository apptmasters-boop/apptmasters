import { describe, it, expect, beforeAll } from "vitest";
import { POST as cleanup } from "@/app/api/cron/cleanup-unverified/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request } from "./helpers";

const SECRET = "test-cron-secret";
beforeAll(() => { process.env.CRON_SECRET = SECRET; });

const run = (secret?: string) =>
  cleanup(request("/api/cron/cleanup-unverified", { method: "POST", headers: secret ? { "x-cron-secret": secret } : {} }));

/** An unconfirmed user created `daysAgo` days ago. */
async function unconfirmedUser(daysAgo: number) {
  const { user } = await createUser({ emailVerified: false });
  return prisma.user.update({ where: { id: user.id }, data: { createdAt: new Date(Date.now() - daysAgo * 86_400_000) } });
}
const exists = async (id: string) => (await prisma.user.findUnique({ where: { id } })) !== null;

describe("POST /api/cron/cleanup-unverified", () => {
  it("requires the cron secret", async () => {
    expect((await run()).status).toBe(401);
    expect((await run("wrong")).status).toBe(401);
  });

  it("deletes unconfirmed sign-ups older than 7 days", async () => {
    const stale = await unconfirmedUser(8);
    expect((await run(SECRET)).status).toBe(200);
    expect(await exists(stale.id)).toBe(false);
  });

  it("keeps recent sign-ups, confirmed accounts, and anyone with something attached", async () => {
    const recent = await unconfirmedUser(2);
    const confirmed = await prisma.user.update({
      where: { id: (await createUser()).user.id },
      data: { createdAt: new Date(Date.now() - 30 * 86_400_000) },
    });
    const withHome = await unconfirmedUser(30);
    await createApartment(withHome.id);
    const admin = await unconfirmedUser(30);
    await prisma.user.update({ where: { id: admin.id }, data: { systemRole: "SUPER_ADMIN" } });

    await run(SECRET);
    for (const u of [recent, confirmed, withHome, admin]) expect(await exists(u.id)).toBe(true);
  });
});
