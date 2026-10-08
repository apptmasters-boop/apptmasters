/**
 * Permission checks on routes outside /api/apartments, found in the Phase S
 * route review (see docs/SECURITY.md).
 */
import { describe, it, expect } from "vitest";
import { DELETE as managerDeleteUser } from "@/app/api/manager/users/[id]/route";
import { POST as sendListingMessage } from "@/app/api/listings/[id]/messages/route";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

async function manager() {
  const m = await createUser({ systemRole: "MANAGER" });
  const apt = await createApartment(m.user.id);
  await prisma.apartment.update({ where: { id: apt.id }, data: { managerId: m.user.id } });
  return { ...m, apt };
}
const deleteUser = (token: string, id: string) =>
  managerDeleteUser(request(`/api/manager/users/${id}`, { method: "DELETE", token }), routeParams({ id }));
const exists = async (id: string) => (await prisma.user.findUnique({ where: { id } })) !== null;

describe("DELETE /api/manager/users/[id]", () => {
  it("cannot delete an unrelated user", async () => {
    const m = await manager();
    const { user: stranger } = await createUser();
    expect((await deleteUser(m.token, stranger.id)).status).toBe(404);
    expect(await exists(stranger.id)).toBe(true);
  });

  it("cannot delete a platform admin", async () => {
    const m = await manager();
    const { user: admin } = await createUser({ systemRole: "SUPER_ADMIN" });
    await prisma.apartmentMember.create({ data: { apartmentId: m.apt.id, userId: admin.id, status: "MOVED_OUT" } });
    expect((await deleteUser(m.token, admin.id)).status).toBe(404);
    expect(await exists(admin.id)).toBe(true);
  });

  it("refuses while the former tenant still lives in an apartment", async () => {
    const m = await manager();
    const { user: tenant } = await createUser();
    await prisma.apartmentMember.create({ data: { apartmentId: m.apt.id, userId: tenant.id, status: "ACTIVE" } });
    expect((await deleteUser(m.token, tenant.id)).status).toBe(409);
  });

  it("deletes a moved-out tenant of the manager's own apartment", async () => {
    const m = await manager();
    const { user: tenant } = await createUser();
    await prisma.apartmentMember.create({ data: { apartmentId: m.apt.id, userId: tenant.id, status: "MOVED_OUT" } });
    expect((await deleteUser(m.token, tenant.id)).status).toBe(200);
    expect(await exists(tenant.id)).toBe(false);
  });
});

describe("POST /api/listings/[id]/messages", () => {
  async function approvedListing(ownerId: string, status = "APPROVED") {
    return prisma.listing.create({
      data: { type: "ROOM_TO_SHARE", status, title: "Room", description: "d", price: 800, city: "Msgville", ownerId },
    });
  }
  const send = (token: string, listingId: string, content: string, withUser?: string) =>
    sendListingMessage(
      request(`/api/listings/${listingId}/messages${withUser ? `?with=${withUser}` : ""}`, { method: "POST", token, body: { content } }),
      routeParams({ id: listingId }),
    );

  it("lets a seeker contact the owner, and the owner reply", async () => {
    const owner = await createUser();
    const seeker = await createUser();
    const listing = await approvedListing(owner.user.id);
    expect((await send(seeker.token, listing.id, "Is it available?")).status).toBe(201);
    expect((await send(owner.token, listing.id, "Yes!", seeker.user.id)).status).toBe(201);
  });

  it("stops an owner from opening a thread with someone who never wrote", async () => {
    const owner = await createUser();
    const { user: stranger } = await createUser();
    const listing = await approvedListing(owner.user.id);
    expect((await send(owner.token, listing.id, "Hi", stranger.id)).status).toBe(404);
  });

  it("refuses new messages about a listing that isn't public", async () => {
    const owner = await createUser();
    const seeker = await createUser();
    const listing = await approvedListing(owner.user.id, "REMOVED");
    expect((await send(seeker.token, listing.id, "Hello")).status).toBe(400);
  });

  it("caps message length", async () => {
    const owner = await createUser();
    const seeker = await createUser();
    const listing = await approvedListing(owner.user.id);
    expect((await send(seeker.token, listing.id, "x".repeat(4001))).status).toBe(400);
  });
});
