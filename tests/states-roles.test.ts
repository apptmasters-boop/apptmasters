/**
 * Sprint 1b: user states (PRODUCT_LOGIC §2.1), where people land after signing
 * in, and household roles controlling who may change shared settings (§2.2, §8.2).
 */
import { describe, it, expect } from "vitest";
import { housingState, landingPath, type MeForLanding } from "@/lib/housing";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as createRotation } from "@/app/api/apartments/[id]/cleaning/route";
import { DELETE as deleteRotation } from "@/app/api/apartments/[id]/cleaning/[rotationId]/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const user = (over: Partial<MeForLanding> = {}): MeForLanding => ({ systemRole: "USER", memberships: [], ...over });
const home = (id: string, status = "ACTIVE") => ({ status, apartment: { id } });

describe("housingState", () => {
  it("is HOME_SEEKER without a home", () => expect(housingState(user())).toBe("HOME_SEEKER"));
  it("is FOUND_A_HOME once self-reported", () => expect(housingState(user({ foundHomeAt: new Date() }))).toBe("FOUND_A_HOME"));
  it("is HOME_MEMBER with an active home", () => expect(housingState(user({ memberships: [home("a")] }))).toBe("HOME_MEMBER"));
  it("doesn't count a pending join request or a moved-out home", () => {
    expect(housingState(user({ memberships: [home("a", "PENDING_APPROVAL"), home("b", "MOVED_OUT")] }))).toBe("HOME_SEEKER");
  });
});

describe("landingPath", () => {
  it("sends home members to their Home", () => {
    expect(landingPath(user({ memberships: [home("a1")] }))).toBe("/apartment/a1");
  });
  it("sends a platform admin who lives in a home to Home, not the admin dashboard", () => {
    expect(landingPath(user({ systemRole: "SUPER_ADMIN", memberships: [home("a1")] }))).toBe("/apartment/a1");
  });
  it("sends home seekers to Find a Home", () => expect(landingPath(user())).toBe("/listings"));
  it("sends someone waiting for approval to Your homes", () => {
    expect(landingPath(user({ memberships: [home("a1", "PENDING_APPROVAL")] }))).toBe("/dashboard");
  });
  it("sends managers and admins without a home to their portals", () => {
    expect(landingPath(user({ systemRole: "MANAGER" }))).toBe("/manager");
    expect(landingPath(user({ systemRole: "SUPER_ADMIN" }))).toBe("/admin");
  });
});

describe("GET /api/auth/me", () => {
  it("reports the housing state", async () => {
    const seeker = await createUser();
    expect((await (await me(request("/api/auth/me", { token: seeker.token }))).json()).housingState).toBe("HOME_SEEKER");

    const member = await createUser();
    await createApartment(member.user.id);
    expect((await (await me(request("/api/auth/me", { token: member.token }))).json()).housingState).toBe("HOME_MEMBER");
  });
});

describe("cleaning rotation settings are for household admins", () => {
  async function household() {
    const admin = await createUser();
    const member = await createUser();
    const apt = await createApartment(admin.user.id); // creator is ADMIN
    await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: member.user.id } });
    return { admin, member, apt, memberIds: [admin.user.id, member.user.id] };
  }
  const create = (token: string, aptId: string, memberIds: string[]) =>
    createRotation(request(`/api/apartments/${aptId}/cleaning`, { method: "POST", token, body: { memberIds } }), routeParams({ id: aptId }));

  it("a regular member can't create a rotation, with a clear message", async () => {
    const { member, apt, memberIds } = await household();
    const res = await create(member.token, apt.id, memberIds);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Only household admins can do this");
  });

  it("a household admin can create one, and only they can delete it", async () => {
    const { admin, member, apt, memberIds } = await household();
    const res = await create(admin.token, apt.id, memberIds);
    expect(res.status).toBe(201);
    const { id: rotationId } = await res.json();

    const del = (token: string) =>
      deleteRotation(request(`/api/apartments/${apt.id}/cleaning/${rotationId}`, { method: "DELETE", token }),
        routeParams({ id: apt.id, rotationId }));
    expect((await del(member.token)).status).toBe(403);
    expect((await del(admin.token)).status).toBe(200);
  });
});
