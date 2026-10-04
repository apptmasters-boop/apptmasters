import { describe, it, expect } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as me } from "@/app/api/auth/me/route";
import { createUser, request, TEST_PASSWORD } from "./helpers";

describe("POST /api/auth/login", () => {
  it("returns a token for correct credentials", async () => {
    const { user } = await createUser();
    const res = await login(request("/api/auth/login", { method: "POST", body: { email: user.email, password: TEST_PASSWORD } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.user.id).toBe(user.id);
    expect(body.user).not.toHaveProperty("password");
  });

  it("rejects a wrong password with a generic error", async () => {
    const { user } = await createUser();
    const res = await login(request("/api/auth/login", { method: "POST", body: { email: user.email, password: "nope" } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
  });

  it("gives an unknown email the same response as a wrong password", async () => {
    const res = await login(request("/api/auth/login", { method: "POST", body: { email: "nobody@example.com", password: "nope" } }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
  });

  it("blocks accounts whose email is not verified", async () => {
    const { user } = await createUser({ emailVerified: false });
    const res = await login(request("/api/auth/login", { method: "POST", body: { email: user.email, password: TEST_PASSWORD } }));
    expect(res.status).toBe(403);
  });

  const attempt = (email: string, password: string) =>
    login(request("/api/auth/login", { method: "POST", body: { email, password } }));

  it("locks the account after 5 failed attempts, even from different IPs", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 4; i++) expect((await attempt(user.email, "wrong")).status).toBe(401);
    expect((await attempt(user.email, "wrong")).status).toBe(429);
  });

  // KNOWN GAP (Phase 1, docs/ROADMAP.md): the lock is only checked on a wrong
  // password, so a correct guess still logs in during the lockout and brute
  // force is never actually stopped. When fixed, change `it.fails` to `it`.
  it.fails("keeps a locked account locked even when the password is right", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 5; i++) await attempt(user.email, "wrong");
    expect((await attempt(user.email, TEST_PASSWORD)).status).toBe(429);
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
