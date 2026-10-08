/**
 * Live streams (EventSource) must not take the login token in the URL; they
 * take a 60-second stream ticket instead. See signStreamTicket in src/lib/auth.ts.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as getTicket } from "@/app/api/stream-ticket/route";
import { GET as chatStream } from "@/app/api/apartments/[id]/chat/stream/route";
import { GET as me } from "@/app/api/auth/me/route";
import { createUser, createApartment, request, routeParams } from "./helpers";

async function ticketFor(token: string) {
  const res = await getTicket(request("/api/stream-ticket", { method: "POST", token }));
  expect(res.status).toBe(200);
  return (await res.json()).ticket as string;
}

/** Opens the chat stream with the given query string and closes it again right away. */
async function openChatStream(apartmentId: string, query: string) {
  const abort = new AbortController();
  const req = new NextRequest(`http://localhost/api/apartments/${apartmentId}/chat/stream?${query}`, { signal: abort.signal });
  const res = await chatStream(req, routeParams({ id: apartmentId }));
  abort.abort(); // stops the stream's polling timers
  await res.body?.cancel().catch(() => {});
  return res.status;
}

afterEach(() => { vi.useRealTimers(); });

describe("POST /api/stream-ticket", () => {
  it("requires sign-in", async () => {
    expect((await getTicket(request("/api/stream-ticket", { method: "POST" }))).status).toBe(401);
  });

  it("issues a ticket that cannot be used as a login token", async () => {
    const { token } = await createUser();
    const ticket = await ticketFor(token);
    expect((await me(request("/api/auth/me", { token: ticket }))).status).toBe(401);
  });
});

describe("chat stream", () => {
  it("opens for a member with a valid ticket", async () => {
    const member = await createUser();
    const apt = await createApartment(member.user.id);
    expect(await openChatStream(apt.id, `ticket=${await ticketFor(member.token)}`)).toBe(200);
  });

  it("refuses the login token in the URL", async () => {
    const member = await createUser();
    const apt = await createApartment(member.user.id);
    expect(await openChatStream(apt.id, `token=${member.token}`)).toBe(401);
  });

  it("refuses a ticket from someone outside the apartment", async () => {
    const member = await createUser();
    const outsider = await createUser();
    const apt = await createApartment(member.user.id);
    expect(await openChatStream(apt.id, `ticket=${await ticketFor(outsider.token)}`)).toBe(403);
  });

  it("refuses an expired ticket", async () => {
    const member = await createUser();
    const apt = await createApartment(member.user.id);
    const ticket = await ticketFor(member.token);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    expect(await openChatStream(apt.id, `ticket=${ticket}`)).toBe(401);
  });
});
