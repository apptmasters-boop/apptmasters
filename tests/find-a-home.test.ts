/**
 * Sprint 12: Find a Home (docs/MARKETPLACE_FLOW.md). The search filters and
 * their chips, only real matches (§7), occupants against the declared capacity
 * (§5), the new listing details, and Saved (§10, §14, §27).
 */
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { GET as search } from "@/app/api/listings/search/route";
import { POST as createListing } from "@/app/api/listings/route";
import { GET as getSaved, POST as save } from "@/app/api/saved/route";
import { DELETE as unsave } from "@/app/api/saved/[listingId]/route";
import { parseFilters, filtersToParams, activeChips, EMPTY_FILTERS } from "@/lib/listingSearch";
import { amenityLabels, placeKind } from "@/lib/listingFields";
import { prisma } from "@/lib/db";
import { createUser, request, routeParams } from "./helpers";

const DAY = 86_400_000;

/** Approved listings in a city of their own, so each test only sees its listings. */
async function place(over: Record<string, unknown> = {}) {
  const owner = await createUser();
  const city = (over.city as string) ?? `City-${randomUUID()}`;
  const listing = await prisma.listing.create({
    data: { type: "APARTMENT_FOR_RENT", status: "APPROVED", title: "Place", description: "d", price: 1500, city, ownerId: owner.user.id, ...over },
  });
  return listing;
}
const find = async (query: string) => (await search(request(`/api/listings/search?${query}`))).json();

describe("filters in the page address", () => {
  it("round-trip, and older links with ?city= still work", () => {
    const p = new URLSearchParams("q=Brooklyn&maxPrice=1800&occupants=2&roomType=PRIVATE_ROOM&amenities=furnished,parking&noBrokerFee=1&sort=price_asc");
    const f = parseFilters(p);
    expect(f).toMatchObject({ q: "Brooklyn", maxPrice: 1800, occupants: 2, roomType: "PRIVATE_ROOM", amenities: ["furnished", "parking"], noBrokerFee: true, sort: "price_asc" });
    expect(parseFilters(filtersToParams(f))).toEqual(f);
    expect(parseFilters(new URLSearchParams("city=Queens")).q).toBe("Queens");
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe("");
  });

  it("ignores values that make no sense", () => {
    const f = parseFilters(new URLSearchParams("occupants=-2&bedrooms=lots&amenities=jacuzzi&sort=random&type=CASTLE"));
    expect(f).toMatchObject({ occupants: null, bedrooms: "", amenities: [], sort: "newest", type: "" });
  });

  it("show as removable chips (§6)", () => {
    const f = parseFilters(new URLSearchParams("q=Brooklyn&maxPrice=1800&occupants=2&roomType=PRIVATE_ROOM&amenities=furnished"));
    expect(activeChips(f).map(c => c.label)).toEqual(["Brooklyn", "Private room", "Under $1,800", "2 people", "Furnished"]);
    const furnished = activeChips(f).find(c => c.label === "Furnished")!;
    expect({ ...f, ...furnished.clear }.amenities).toEqual([]);
  });
});

describe("search finds only real matches", () => {
  it("occupants: only listings that declare room for that many (never guessed from bedrooms)", async () => {
    const city = `City-${randomUUID()}`;
    const four = await place({ city, maxOccupants: 4, bedrooms: 2 });
    await place({ city, maxOccupants: 1, bedrooms: 3 });
    await place({ city, bedrooms: 2 }); // capacity not stated
    const res = await find(`q=${city}&occupants=2`);
    expect(res.listings.map((l: { id: string }) => l.id)).toEqual([four.id]);
    expect(res.total).toBe(1);
  });

  it("the details: bedrooms 3+, amenities, laundry, smoke-free, no broker fee, lease, recently listed", async () => {
    const city = `City-${randomUUID()}`;
    const match = await place({
      city, bedrooms: 3, furnished: true, parking: true, laundry: "IN_UNIT", smokingAllowed: false, brokerFee: 0, leaseMonths: 12,
    });
    await place({ city, bedrooms: 3, furnished: true, parking: false, laundry: "IN_UNIT", smokingAllowed: false, brokerFee: 0, leaseMonths: 12 });
    await place({ city, bedrooms: 3, furnished: true, parking: true, laundry: "NONE", smokingAllowed: false, brokerFee: 0, leaseMonths: 12 });
    await place({ city, bedrooms: 3, furnished: true, parking: true, laundry: "IN_UNIT", smokingAllowed: false, brokerFee: 1500, leaseMonths: 12 });
    await place({ city, bedrooms: 3, furnished: true, parking: true, laundry: "IN_UNIT", smokingAllowed: false, brokerFee: 0, leaseMonths: 0 });
    await place({ city, bedrooms: 3, furnished: true, parking: true, laundry: "IN_UNIT", smokingAllowed: false, brokerFee: 0, leaseMonths: 12, createdAt: new Date(Date.now() - 40 * DAY) });
    const res = await find(`q=${city}&bedrooms=3%2B&amenities=furnished,parking&laundry=1&smoking=free&noBrokerFee=1&lease=12&listedWithin=30`);
    expect(res.listings.map((l: { id: string }) => l.id)).toEqual([match.id]);
  });

  it("move-in date: available by then, or no date given (available now)", async () => {
    const city = `City-${randomUUID()}`;
    const soon = await place({ city, availableFrom: new Date("2027-03-01T00:00:00Z") });
    const now = await place({ city });
    await place({ city, availableFrom: new Date("2027-06-01T00:00:00Z") });
    const ids = (await find(`q=${city}&moveIn=2027-04-01`)).listings.map((l: { id: string }) => l.id).sort();
    expect(ids).toEqual([soon.id, now.id].sort());
  });

  it("place by city, neighborhood or ZIP; tabs count whole places and rooms; sorted by price", async () => {
    const city = `City-${randomUUID()}`;
    await place({ city, price: 2000, neighborhood: "Bushwick" });
    await place({ city, price: 900, type: "ROOM_TO_SHARE", neighborhood: "Bushwick" });
    await place({ city, price: 1200, zipCode: "11216" });
    const res = await find(`q=${city}&sort=price_asc`);
    expect(res.listings.map((l: { price: number }) => l.price)).toEqual([900, 1200, 2000]);
    expect(res.counts).toEqual({ all: 3, APARTMENT_FOR_RENT: 2, ROOM_TO_SHARE: 1 });
    // A type filter keeps the tab counts for the others.
    const rooms = await find(`q=${city}&type=ROOM_TO_SHARE`);
    expect(rooms.total).toBe(1);
    expect(rooms.counts.all).toBe(3);
    expect((await find("q=Bushwick")).listings.length).toBeGreaterThanOrEqual(2);
    expect((await find("q=11216")).listings.some((l: { zipCode: string }) => l.zipCode === "11216")).toBe(true);
  });

  it("an empty result is empty, and nothing private is sent", async () => {
    const city = `City-${randomUUID()}`;
    await place({ city, address: "1234 Myrtle Ave", maxOccupants: 1 });
    expect((await find(`q=${city}&occupants=3`)).listings).toEqual([]);
    const [l] = (await find(`q=${city}`)).listings;
    expect(l).not.toHaveProperty("address");
    expect(l).not.toHaveProperty("rejectionReason");
    expect(l.owner).toEqual({ id: expect.any(String), name: "Test", since: expect.any(String) });
  });
});

describe("the listing details", () => {
  const body = { type: "APARTMENT_FOR_RENT", title: "Flat", description: "d", price: 1800, city: "Brooklyn", photoUrls: ["/uploads/listings/a.jpg"] };

  it("a new listing must say how many people can live there; the rest is optional", async () => {
    const { token } = await createUser();
    const post = (b: unknown) => createListing(request("/api/listings", { method: "POST", token, body: b }));
    expect((await post(body)).status).toBe(400);
    const res = await post({ ...body, maxOccupants: 4, propertyType: "APARTMENT", roomType: "PRIVATE_ROOM", furnished: true, brokerFee: 0, zipCode: "11216", neighborhood: "Prospect Heights" });
    expect(res.status).toBe(201);
    const saved = await prisma.listing.findUniqueOrThrow({ where: { id: (await res.json()).id } });
    expect(saved).toMatchObject({ maxOccupants: 4, propertyType: "APARTMENT", roomType: null, furnished: true, brokerFee: 0, zipCode: "11216", parking: null });
    expect((await post({ ...body, maxOccupants: 2, zipCode: "1121" })).status).toBe(400);
  });

  it("read as people say them", () => {
    expect(amenityLabels({ furnished: true, internetIncluded: true, laundry: "IN_BUILDING", parking: false, smokingAllowed: false }))
      .toEqual(["Furnished", "Wi-Fi included", "Laundry", "Smoke-free"]);
    expect(placeKind({ type: "ROOM_TO_SHARE", roomType: "PRIVATE_ROOM" })).toBe("Private room");
    expect(placeKind({ type: "APARTMENT_FOR_RENT", propertyType: null })).toBe("Whole place");
  });
});

describe("Saved", () => {
  it("needs an account (checked by the server)", async () => {
    const l = await place();
    expect((await getSaved(request("/api/saved"))).status).toBe(401);
    expect((await save(request("/api/saved", { method: "POST", body: { listingId: l.id } }))).status).toBe(401);
  });

  it("saves once, lists, keeps a listing that's no longer available with its status, and removes", async () => {
    const me = await createUser();
    const l = await place({ title: "Saved place", address: "secret" });
    const post = () => save(request("/api/saved", { method: "POST", token: me.token, body: { listingId: l.id } }));
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201); // saving again changes nothing
    expect(await prisma.savedListing.count({ where: { userId: me.user.id } })).toBe(1);
    expect((await (await getSaved(request("/api/saved?ids=1", { token: me.token }))).json()).ids).toEqual([l.id]);

    await prisma.listing.update({ where: { id: l.id }, data: { status: "REMOVED" } });
    const list = await (await getSaved(request("/api/saved", { token: me.token }))).json();
    expect(list).toHaveLength(1);
    expect(list[0].listing).toMatchObject({ title: "Saved place", status: "REMOVED" });
    expect(list[0].listing).not.toHaveProperty("address");

    await unsave(request(`/api/saved/${l.id}`, { method: "DELETE", token: me.token }), routeParams({ listingId: l.id }));
    expect(await prisma.savedListing.count({ where: { userId: me.user.id } })).toBe(0);
  });

  it("only listings people can see can be saved", async () => {
    const me = await createUser();
    const pending = await place({ status: "PENDING" });
    expect((await save(request("/api/saved", { method: "POST", token: me.token, body: { listingId: pending.id } }))).status).toBe(404);
  });
});
