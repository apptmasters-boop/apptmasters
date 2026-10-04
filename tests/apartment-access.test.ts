/**
 * Apartment data must only be visible to that apartment's members.
 *
 * KNOWN GAPS (found 2026-10-03, scheduled for Phase 1 in docs/ROADMAP.md):
 * several routes check that the caller is signed in but not that they belong
 * to the apartment. Those cases use `it.fails`, which passes while the bug
 * exists. When a route is fixed, its `it.fails` will start failing: change it
 * to a plain `it` so the fix stays protected.
 */
import { describe, it, expect } from "vitest";
import { GET as apartment } from "@/app/api/apartments/[id]/route";
import { GET as chat } from "@/app/api/apartments/[id]/chat/route";
import { GET as grocery } from "@/app/api/apartments/[id]/grocery/route";
import { GET as inventory } from "@/app/api/apartments/[id]/inventory/route";
import { GET as calendar } from "@/app/api/apartments/[id]/calendar/route";
import { GET as feed } from "@/app/api/apartments/[id]/feed/route";
import { GET as fund } from "@/app/api/apartments/[id]/fund/route";
import { createUser, createApartment, request, routeParams } from "./helpers";

type Handler = (req: ReturnType<typeof request>, ctx: ReturnType<typeof routeParams<{ id: string }>>) => Promise<Response>;

async function setup() {
  const member = await createUser();
  const outsider = await createUser();
  const apt = await createApartment(member.user.id);
  return { member, outsider, apt };
}

const isDenied = (status: number) => status === 401 || status === 403 || status === 404;

const routes: { name: string; handler: Handler; knownGap: boolean }[] = [
  { name: "apartment details", handler: apartment as Handler, knownGap: false },
  { name: "group chat", handler: chat as Handler, knownGap: true },
  { name: "grocery list", handler: grocery as Handler, knownGap: true },
  { name: "inventory", handler: inventory as Handler, knownGap: true },
  { name: "calendar", handler: calendar as Handler, knownGap: true },
  { name: "activity feed", handler: feed as Handler, knownGap: true },
  { name: "house fund", handler: fund as Handler, knownGap: true },
];

describe.each(routes)("GET apartment $name", ({ name, handler, knownGap }) => {
  const path = (id: string) => `/api/apartments/${id}/${name}`;

  it("rejects requests without a token", async () => {
    const { apt } = await setup();
    const res = await handler(request(path(apt.id)), routeParams({ id: apt.id }));
    expect(res.status).toBe(401);
  });

  it("lets a member read it", async () => {
    const { member, apt } = await setup();
    const res = await handler(request(path(apt.id), { token: member.token }), routeParams({ id: apt.id }));
    expect(res.status).toBe(200);
  });

  (knownGap ? it.fails : it)("blocks a signed-in user from another apartment", async () => {
    const { outsider, apt } = await setup();
    const res = await handler(request(path(apt.id), { token: outsider.token }), routeParams({ id: apt.id }));
    expect(isDenied(res.status), `outsider got HTTP ${res.status}`).toBe(true);
  });
});
