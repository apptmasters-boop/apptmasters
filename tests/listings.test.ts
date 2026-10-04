import { describe, it, expect } from "vitest";
import { GET as browse, POST as create } from "@/app/api/listings/route";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { createUser, request } from "./helpers";

const validListing = {
  type: "ROOM_TO_SHARE",
  title: "Test room",
  description: "A room for tests",
  price: 900,
  city: "Testville",
  photoUrls: ["/uploads/listings/test.jpg"],
};

/** A city name no other test (or earlier run) uses, so queries only see this test's rows. */
const uniqueCity = () => `City-${randomUUID()}`;

async function listingWithStatus(ownerId: string, status: string, title: string, city: string) {
  return prisma.listing.create({
    data: { type: "APARTMENT_FOR_RENT", status, title, description: "d", price: 1000, city, ownerId },
  });
}

describe("GET /api/listings", () => {
  it("only shows approved listings to the public", async () => {
    const { user } = await createUser();
    const city = uniqueCity();
    await listingWithStatus(user.id, "APPROVED", "approved-one", city);
    for (const status of ["PENDING", "REJECTED", "REMOVED"]) await listingWithStatus(user.id, status, `${status}-one`, city);

    const res = await browse(request(`/api/listings?city=${city}`));
    expect(res.status).toBe(200);
    const titles = (await res.json()).map((l: { title: string }) => l.title);
    expect(titles).toEqual(["approved-one"]);
  });

  it("does not expose owner emails", async () => {
    const { user } = await createUser();
    const city = uniqueCity();
    await listingWithStatus(user.id, "APPROVED", "privacy-check", city);
    const listings = await (await browse(request(`/api/listings?city=${city}`))).json();
    expect(JSON.stringify(listings)).not.toContain(user.email);
  });
});

describe("POST /api/listings", () => {
  it("requires sign-in", async () => {
    const res = await create(request("/api/listings", { method: "POST", body: validListing }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid input", async () => {
    const { token } = await createUser();
    const res = await create(request("/api/listings", { method: "POST", token, body: { ...validListing, price: -5 } }));
    expect(res.status).toBe(400);
  });

  it("creates the listing as PENDING so it stays hidden until reviewed", async () => {
    const { user, token } = await createUser();
    const city = uniqueCity();
    const res = await create(request("/api/listings", { method: "POST", token, body: { ...validListing, city } }));
    expect(res.status).toBe(201);
    const listing = await res.json();
    expect(listing.status).toBe("PENDING");
    expect(listing.ownerId).toBe(user.id);

    const visible = await (await browse(request(`/api/listings?city=${city}`))).json();
    expect(visible).toHaveLength(0);
  });

  it("ignores a client-supplied status and owner", async () => {
    const { user, token } = await createUser();
    const { user: other } = await createUser();
    const res = await create(request("/api/listings", {
      method: "POST", token, body: { ...validListing, status: "APPROVED", ownerId: other.id },
    }));
    const listing = await res.json();
    expect(listing.status).toBe("PENDING");
    expect(listing.ownerId).toBe(user.id);
  });
});
