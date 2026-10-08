import { describe, it, expect } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as verify2fa } from "@/app/api/auth/2fa/verify/route";
import { POST as send2fa } from "@/app/api/auth/2fa/send/route";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createUser, request, TEST_PASSWORD } from "./helpers";

const attempt = (email: string, password: string, opts: { ip?: string; headers?: Record<string, string> } = {}) =>
  login(request("/api/auth/login", { method: "POST", body: { email, password }, ...opts }));

describe("POST /api/auth/login", () => {
  it("returns a token for correct credentials", async () => {
    const { user } = await createUser();
    const res = await attempt(user.email, TEST_PASSWORD);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user.id).toBe(user.id);
    expect(body.user).not.toHaveProperty("password");
  });

  it("rejects a wrong password with a generic error", async () => {
    const { user } = await createUser();
    const res = await attempt(user.email, "nope");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
  });

  it("gives an unknown email the same response as a wrong password", async () => {
    const res = await attempt("nobody@example.com", "nope");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
  });

  it("blocks accounts whose email is not verified", async () => {
    const { user } = await createUser({ emailVerified: false });
    expect((await attempt(user.email, TEST_PASSWORD)).status).toBe(403);
  });

  it("locks the account after 5 failed attempts, even from different IPs", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 4; i++) expect((await attempt(user.email, "wrong")).status).toBe(401);
    expect((await attempt(user.email, "wrong")).status).toBe(429);
  });

  it("keeps a locked account locked even when the password is right", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 5; i++) await attempt(user.email, "wrong");
    expect((await attempt(user.email, TEST_PASSWORD)).status).toBe(429);
  });

  it("cannot dodge the per-IP limit by faking X-Forwarded-For", async () => {
    const ip = "203.0.113.7";
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      // A different random-looking account each time, so only the IP limit can trigger
      const res = await attempt(`probe-${i}-${Date.now()}@example.com`, "x", { ip, headers: { "x-forwarded-for": `198.51.100.${i}` } });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});

describe("two-factor sign-in", () => {
  async function twoFactorUser() {
    const created = await createUser();
    await prisma.user.update({ where: { id: created.user.id }, data: { twoFactorEnabled: true } });
    return created;
  }
  async function passwordStep(email: string) {
    const res = await attempt(email, TEST_PASSWORD);
    expect(res.status).toBe(200);
    return res.json();
  }
  const latestCode = async (userId: string) =>
    (await prisma.twoFactorCode.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }))!.code;
  const verify = (body: unknown) => verify2fa(request("/api/auth/2fa/verify", { method: "POST", body }));

  it("does not hand out a login token after just the password", async () => {
    const { user } = await twoFactorUser();
    const body = await passwordStep(user.email);
    expect(body.twoFactorRequired).toBe(true);
    expect(body.challenge).toEqual(expect.any(String));
    expect(body).not.toHaveProperty("token");
  });

  it("does not accept the challenge as a login token", async () => {
    const { user } = await twoFactorUser();
    const { challenge } = await passwordStep(user.email);
    expect((await me(request("/api/auth/me", { token: challenge }))).status).toBe(401);
  });

  it("logs in with the challenge plus the emailed code", async () => {
    const { user } = await twoFactorUser();
    const { challenge } = await passwordStep(user.email);
    const res = await verify({ challenge, code: await latestCode(user.id) });
    expect(res.status).toBe(200);
    const { token } = await res.json();
    expect((await me(request("/api/auth/me", { token }))).status).toBe(200);
  });

  it("refuses a code without a challenge (email alone is not enough)", async () => {
    const { user } = await twoFactorUser();
    await passwordStep(user.email);
    const res = await verify({ email: user.email, code: await latestCode(user.id) });
    expect(res.status).toBe(400);
  });

  it("locks after 5 wrong codes, even for the right code", async () => {
    const { user } = await twoFactorUser();
    const { challenge } = await passwordStep(user.email);
    for (let i = 0; i < 5; i++) await verify({ challenge, code: "000000" });
    expect((await verify({ challenge, code: await latestCode(user.id) })).status).toBe(429);
  });

  it("accepts a backup code once (in any letter case)", async () => {
    const { user } = await twoFactorUser();
    await prisma.backupCode.create({ data: { userId: user.id, codeHash: await bcrypt.hash("ABCD-EF23", 4) } });
    const { challenge } = await passwordStep(user.email);
    expect((await verify({ challenge, code: "abcd-ef23" })).status).toBe(200);

    const { challenge: again } = await passwordStep(user.email);
    expect((await verify({ challenge: again, code: "ABCD-EF23" })).status).toBe(401);
  });

  it("only re-sends a code for a valid challenge", async () => {
    const send = (body: unknown) => send2fa(request("/api/auth/2fa/send", { method: "POST", body }));
    expect((await send({ email: "someone@example.com" })).status).toBe(400);
    expect((await send({ challenge: "not-a-real-challenge" })).status).toBe(401);
  });
});

describe("POST /api/auth/register", () => {
  it("is closed while sign-up is invite-only", async () => {
    const res = await register();
    expect(res.status).toBe(503);
  });
});

describe("GET /api/auth/me", () => {
  it("requires a token", async () => {
    expect((await me(request("/api/auth/me"))).status).toBe(401);
  });

  it("rejects a tampered token", async () => {
    const { token } = await createUser();
    const tampered = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect((await me(request("/api/auth/me", { token: tampered }))).status).toBe(401);
  });

  it("returns the signed-in user without the password hash", async () => {
    const { user, token } = await createUser();
    const res = await me(request("/api/auth/me", { token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe(user.email);
    expect(body).not.toHaveProperty("password");
  });
});
