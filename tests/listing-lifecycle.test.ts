/**
 * Listing lifecycle L2 (owner, 2026-10-18): "Mark as rented" deletes the photos and keeps
 * the details; Relist edits the same listing with new photos and goes to review; photo
 * files leave the disk when they're no longer shown, but never someone else's or any
 * other file.
 */
import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { PATCH as patchListing, DELETE as deleteListing } from "@/app/api/listings/[id]/route";
import { prisma } from "@/lib/db";
import { removeListingFiles } from "@/lib/uploads";
import { createUser, request, routeParams } from "./helpers";

const made: string[] = [];
/** A real photo file in public/uploads/<folder>, named like the app's uploads. */
async function photoFile(folder = "listings") {
  const url = `/uploads/${folder}/${randomUUID()}.jpg`;
  const path = join(process.cwd(), "public", url);
  await mkdir(join(process.cwd(), "public", "uploads", folder), { recursive: true });
  await writeFile(path, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  made.push(path);
  return url;
}
const onDisk = (url: string) => existsSync(join(process.cwd(), "public", url));
afterAll(async () => { await Promise.all(made.map(p => unlink(p).catch(() => {}))); });

async function listing(ownerId: string, photos: string[], over: Record<string, unknown> = {}) {
  return prisma.listing.create({
    data: {
      type: "APARTMENT_FOR_RENT", status: "APPROVED", title: "Sunny 2BR", description: "Bright", price: 2100, city: "Lifecycleville",
      bedrooms: 2, squareFeet: 850, laundry: "IN_UNIT", ownerId, ...over,
      photos: { create: photos.map((url, position) => ({ url, position })) },
    },
  });
}
const act = (token: string, id: string, body: unknown) =>
  patchListing(request(`/api/listings/${id}`, { method: "PATCH", token, body }), routeParams({ id }));
const edit = (token: string, id: string, over: Record<string, unknown>) =>
  act(token, id, { type: "APARTMENT_FOR_RENT", title: "Sunny 2BR", description: "Bright", price: 2100, city: "Lifecycleville", maxOccupants: 2, photoUrls: [], ...over });

describe("Mark as rented (L2)", () => {
  it("hides it, deletes its photos (rows and files) and keeps every other detail", async () => {
    const owner = await createUser();
    const [a, b] = [await photoFile(), await photoFile()];
    const l = await listing(owner.user.id, [a, b]);
    const res = await act(owner.token, l.id, { action: "MARK_RENTED" });
    expect(res.status).toBe(200);
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: l.id }, include: { photos: true } });
    expect(after.status).toBe("RENTED");
    expect(after.photos).toHaveLength(0);
    expect(onDisk(a) || onDisk(b)).toBe(false);
    expect(after).toMatchObject({ title: "Sunny 2BR", price: 2100, bedrooms: 2, squareFeet: 850, laundry: "IN_UNIT", city: "Lifecycleville" });
    // Again: nothing more happens.
    expect((await act(owner.token, l.id, { action: "MARK_RENTED" })).status).toBe(200);
  });

  it("the old action name does the same", async () => {
    const owner = await createUser();
    const l = await listing(owner.user.id, [await photoFile()]);
    await act(owner.token, l.id, { action: "MARK_REMOVED" });
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("RENTED");
  });

  it("only the owner can", async () => {
    const owner = await createUser();
    const other = await createUser();
    const a = await photoFile();
    const l = await listing(owner.user.id, [a]);
    expect((await act(other.token, l.id, { action: "MARK_RENTED" })).status).toBe(403);
    expect(onDisk(a)).toBe(true);
  });
});

describe("Relist (L2)", () => {
  it("edits the same listing with new photos and sends it to review", async () => {
    const owner = await createUser();
    const l = await listing(owner.user.id, [], { status: "RENTED" });
    const fresh = await photoFile();
    expect((await edit(owner.token, l.id, { photoUrls: [] })).status).toBe(400); // a photo is needed
    const res = await edit(owner.token, l.id, { price: 2250, photoUrls: [fresh] });
    expect(res.status).toBe(200);
    const after = await prisma.listing.findUniqueOrThrow({ where: { id: l.id }, include: { photos: true } });
    expect(after.status).toBe("PENDING");
    expect(after.price).toBe(2250);
    expect(after.photos.map(p => p.url)).toEqual([fresh]);
  });

  it("asks for a new date when the old one has passed", async () => {
    const owner = await createUser();
    const l = await listing(owner.user.id, [], { status: "RENTED" });
    const res = await edit(owner.token, l.id, { availableFrom: "2020-01-01", photoUrls: [await photoFile()] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/new "available from" date/);
  });

  it("a listing ApptMasters removed can't be edited back", async () => {
    const owner = await createUser();
    const l = await listing(owner.user.id, [], { status: "REMOVED" });
    expect((await edit(owner.token, l.id, { photoUrls: [await photoFile()] })).status).toBe(400);
    expect((await act(owner.token, l.id, { action: "MARK_RENTED" })).status).toBe(400);
  });
});

describe("Photo files leave the disk when nobody shows them (L2)", () => {
  it("an edit deletes the photos taken out, keeps the ones still there", async () => {
    const owner = await createUser();
    const [a, b, c] = [await photoFile(), await photoFile(), await photoFile()];
    const l = await listing(owner.user.id, [a, b], { status: "PENDING" });
    expect((await edit(owner.token, l.id, { photoUrls: [b, c] })).status).toBe(200);
    expect(onDisk(a)).toBe(false);
    expect(onDisk(b)).toBe(true);
    expect(onDisk(c)).toBe(true);
  });

  it("deleting a listing deletes its photos", async () => {
    const owner = await createUser();
    const a = await photoFile();
    const l = await listing(owner.user.id, [a]);
    const res = await deleteListing(request(`/api/listings/${l.id}`, { method: "DELETE", token: owner.token }), routeParams({ id: l.id }));
    expect(res.status).toBe(200);
    expect(onDisk(a)).toBe(false);
  });

  it("never deletes a photo another listing shows (someone copying its address)", async () => {
    const victim = await createUser();
    const copier = await createUser();
    const shared = await photoFile();
    await listing(victim.user.id, [shared]);
    const copy = await listing(copier.user.id, [shared]);
    await act(copier.token, copy.id, { action: "MARK_RENTED" });
    expect(onDisk(shared)).toBe(true);
  });

  it("never touches anything but listing uploads", async () => {
    const avatar = await photoFile("avatars");
    const name = avatar.split("/").pop()!;
    const tricks = [avatar, `/uploads/listings/../avatars/${name}`, `/uploads/listings/..%2Favatars%2F${name}`, "/uploads/listings/x.jpg", "../../.env.local"];
    expect(await removeListingFiles(tricks, "none")).toBe(0);
    expect(onDisk(avatar)).toBe(true);
  });
});
