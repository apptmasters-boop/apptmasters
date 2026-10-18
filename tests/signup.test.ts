/**
 * Sign-up must not produce a usable account until the email is confirmed.
 * See src/lib/emailVerification.ts for the flow.
 */
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { POST as signup } from "@/app/api/listings/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { POST as resendLink } from "@/app/api/auth/resend-verification/route";
import { intentFromReturnTo, afterSignup } from "@/lib/intent";
import { prisma } from "@/lib/db";
import { esc } from "@/lib/email";
import { safeReturnTo } from "@/lib/returnTo";
import { createUser, request } from "./helpers";

const PASSWORD = "Passw0rd-123";
const newEmail = () => `signup-${randomUUID()}@example.com`;
const sent = () => (globalThis as unknown as { sentEmails: { to: string; subject: string; html: string }[] }).sentEmails;

const signUp = (body: Record<string, unknown>) =>
  signup(request("/api/listings/signup", { method: "POST", body: { name: "New Person", password: PASSWORD, intent: "FIND_HOME", ...body } }));
const logIn = (email: string, password = PASSWORD) =>
  login(request("/api/auth/login", { method: "POST", body: { email, password } }));

/** Where the newest confirmation link emailed to `email` leads after confirming. */
function linkReturnTo(email: string) {
  const mail = [...sent()].reverse().find(m => m.to === email);
  const href = mail?.html.match(/href="([^"]+verify-email[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  return href ? new URL(href).searchParams.get("returnTo") : null;
}

/** The token from the newest confirmation link emailed to `email`. */
function linkTokenFor(email: string) {
  const mail = [...sent()].reverse().find(m => m.to === email);
  const href = mail?.html.match(/href="([^"]+verify-email[^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  return href ? new URL(href).searchParams.get("token") : null;
}

describe("POST /api/listings/signup", () => {
  it("does not return a login token and stores the account as unconfirmed", async () => {
    const email = newEmail();
    const res = await signUp({ email });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ pending: true, email });
    expect(body).not.toHaveProperty("token");
    expect((await prisma.user.findUnique({ where: { email } }))?.emailVerified).toBe(false);
  });

  it("emails a confirmation link", async () => {
    const email = newEmail();
    await signUp({ email });
    expect(linkTokenFor(email)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to sign in until the email is confirmed, then allows it", async () => {
    const email = newEmail();
    await signUp({ email });
    expect((await logIn(email)).status).toBe(403);

    const res = await verifyEmail(request("/api/auth/verify-email", { method: "POST", body: { token: linkTokenFor(email) } }));
    expect(res.status).toBe(200);
    expect((await res.json()).token).toEqual(expect.any(String));
    expect((await logIn(email)).status).toBe(200);
  });

  it("a confirmation link only works once", async () => {
    const email = newEmail();
    await signUp({ email });
    const token = linkTokenFor(email);
    const confirm = () => verifyEmail(request("/api/auth/verify-email", { method: "POST", body: { token } }));
    expect((await confirm()).status).toBe(200);
    expect((await confirm()).status).toBe(400);
  });

  it("rejects an email that already has a confirmed account", async () => {
    const { user } = await createUser();
    expect((await signUp({ email: user.email })).status).toBe(409);
  });

  it("lets the real owner take over an unconfirmed sign-up made with their email", async () => {
    const email = newEmail();
    await signUp({ email, name: "Impostor", password: "Impostor-999" });
    const res = await signUp({ email, name: "Real Owner" });
    expect(res.status).toBe(201);

    await verifyEmail(request("/api/auth/verify-email", { method: "POST", body: { token: linkTokenFor(email) } }));
    expect((await logIn(email, "Impostor-999")).status).toBe(401);
    expect((await logIn(email)).status).toBe(200);
    expect((await prisma.user.findUnique({ where: { email } }))?.name).toBe("Real Owner");
  });

  it("escapes the name in the email, so it can't inject links", async () => {
    const email = newEmail();
    await signUp({ email, name: '<a href="https://evil.example">Claim your deposit</a>' });
    const mail = [...sent()].reverse().find(m => m.to === email)!;
    expect(mail.html).not.toContain('<a href="https://evil.example"');
    expect(mail.html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
  });

  it("drops an off-site returnTo from the confirmation link", async () => {
    const email = newEmail();
    await signUp({ email, returnTo: "https://evil.example/login" });
    const mail = [...sent()].reverse().find(m => m.to === email)!;
    expect(mail.html).not.toContain("evil.example");
  });
});

describe("What brings you to ApptMasters? (step O1)", () => {
  it("is required, and only the three answers are accepted", async () => {
    const missing = await signUp({ email: newEmail(), intent: undefined });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("Choose what brings you to ApptMasters");
    expect((await signUp({ email: newEmail(), intent: "LANDLORD" })).status).toBe(400);
  });

  it("is saved; Set up my home also counts as I found a place", async () => {
    const home = newEmail(), rent = newEmail(), find = newEmail();
    await signUp({ email: home, intent: "HAVE_HOME" });
    await signUp({ email: rent, intent: "RENT_OUT" });
    await signUp({ email: find, intent: "FIND_HOME" });
    const [h, r, f] = await Promise.all([home, rent, find].map(email => prisma.user.findUniqueOrThrow({ where: { email } })));
    expect([h.intent, r.intent, f.intent]).toEqual(["HAVE_HOME", "RENT_OUT", "FIND_HOME"]);
    expect(h.foundHomeAt).toBeInstanceOf(Date);
    expect(r.foundHomeAt).toBeNull();
    expect(f.foundHomeAt).toBeNull();
  });

  it("the link goes back to what they were doing when it fits the answer, else to the answer's start", async () => {
    const saver = newEmail(), changed = newEmail(), home = newEmail(), plain = newEmail();
    await signUp({ email: saver, intent: "FIND_HOME", returnTo: "/listings/abc?save=abc" });
    await signUp({ email: changed, intent: "RENT_OUT", returnTo: "/listings/abc" });
    await signUp({ email: home, intent: "HAVE_HOME" });
    await signUp({ email: plain, intent: "FIND_HOME", returnTo: "/" });
    expect(linkReturnTo(saver)).toBe("/listings/abc?save=abc");
    expect(linkReturnTo(changed)).toBe("/listings/new");
    expect(linkReturnTo(home)).toBe("/apartment/create");
    expect(linkReturnTo(plain)).toBe("/");
  });

  it("a resent link starts where the answer does", async () => {
    const email = newEmail();
    await signUp({ email, intent: "RENT_OUT" });
    expect((await resendLink(request("/api/auth/resend-verification", { method: "POST", body: { email } }))).status).toBe(200);
    expect(linkReturnTo(email)).toBe("/listings/new");
  });

  it("pre-selects the answer from the page they signed up from", () => {
    expect(intentFromReturnTo("/?save=abc")).toBe("FIND_HOME");
    expect(intentFromReturnTo("/listings/abc/messages")).toBe("FIND_HOME");
    expect(intentFromReturnTo("/listings?q=Brooklyn")).toBe("FIND_HOME");
    expect(intentFromReturnTo("/listings/new")).toBe("RENT_OUT");
    expect(intentFromReturnTo("/apartment/create")).toBe("HAVE_HOME");
    expect(intentFromReturnTo("/apartment/join?code=AB12")).toBe("HAVE_HOME");
    expect(intentFromReturnTo("/")).toBeNull();
    expect(intentFromReturnTo("")).toBeNull();
    expect(afterSignup("FIND_HOME", "https://evil.example/listings/x")).toBe("/");
  });
});

describe("safeReturnTo", () => {
  it("keeps same-site paths", () => {
    expect(safeReturnTo("/listings/new", "/x")).toBe("/listings/new");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null])(
    "falls back for %s", value => {
      expect(safeReturnTo(value, "/home")).toBe("/home");
    });
});

describe("esc", () => {
  it("escapes HTML special characters", () => {
    expect(esc(`<b a="1">'&'</b>`)).toBe("&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;");
  });
});
