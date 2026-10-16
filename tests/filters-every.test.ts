/**
 * Fix F1 (owner, 2026-10-16: "make sure all filters work"): every Find a Home
 * filter, one by one, returns exactly the listings that match, through the
 * same search the pages use (GET /api/listings/search). Five listings with
 * deliberately different details live in a city of their own.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { GET as search } from "@/app/api/listings/search/route";
import { parseAmount, orderedPrices, parseFilters } from "@/lib/listingSearch";
import { prisma } from "@/lib/db";
import { createUser, request } from "./helpers";

const DAY = 86_400_000;
const city = `Filtertown-${randomUUID()}`;
const hood = `Hood-${randomUUID().slice(0, 8)}`;
const ids: Record<string, string> = {};
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

beforeAll(async () => {
  const owner = await createUser();
  const base = { status: "APPROVED", description: "d", city, state: "NY", ownerId: owner.user.id };
  const ago = (days: number) => new Date(Date.now() - days * DAY);
  const rows: Record<string, Record<string, unknown>> = {
    L1: { type: "APARTMENT_FOR_RENT", propertyType: "APARTMENT", title: "L1", price: 900, bedrooms: 1, bathrooms: 1, maxOccupants: 2, squareFeet: 600,
      leaseMonths: 0, furnished: true, internetIncluded: true, laundry: "IN_UNIT", smokingAllowed: false, brokerFee: 0, applicationFee: 0, createdAt: ago(0) },
    L2: { type: "APARTMENT_FOR_RENT", propertyType: "HOUSE", title: "L2", price: 2500, bedrooms: 3, bathrooms: 2, maxOccupants: 5, squareFeet: 1600,
      availableFrom: new Date(Date.now() + 60 * DAY), leaseMonths: 12, parking: true, petsAllowed: true, laundry: "IN_BUILDING", smokingAllowed: true,
      brokerFee: 2000, applicationFee: 50, createdAt: ago(10) },
    L3: { type: "ROOM_TO_SHARE", roomType: "PRIVATE_ROOM", propertyType: "APARTMENT", title: "L3", price: 1200, bedrooms: 1, bathrooms: 1, maxOccupants: 1,
      squareFeet: 800, availableFrom: new Date(Date.now() + 10 * DAY), leaseMonths: 6, utilitiesIncluded: true, privateBathroom: true, elevator: true,
      accessible: true, airConditioning: true, heatIncluded: true, dishwasher: true, laundry: "NONE", createdAt: ago(40) },
    L4: { type: "APARTMENT_FOR_RENT", propertyType: "STUDIO", title: "L4", price: 1500, bedrooms: 0, bathrooms: 1, maxOccupants: 2, leaseMonths: 24,
      neighborhood: hood, zipCode: "11237", createdAt: ago(3) },
    L5: { type: "ROOM_TO_SHARE", roomType: "SHARED_ROOM", title: "L5", price: 700, bedrooms: 2, bathrooms: 1, maxOccupants: 3, createdAt: ago(0) },
  };
  for (const [name, data] of Object.entries(rows)) {
    ids[name] = (await prisma.listing.create({ data: { ...base, ...data } as never })).id;
  }
});

async function titles(query: string) {
  const res = await search(request(`/api/listings/search?q=${encodeURIComponent(city)}${query ? `&${query}` : ""}`));
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.listings.map((l: { title: string }) => l.title) as string[];
}
const sorted = (a: string[]) => [...a].sort();

describe("every filter returns exactly the matching listings", () => {
  const cases: [string, string, string[]][] = [
    ["no filter", "", ["L1", "L2", "L3", "L4", "L5"]],
    // Kind of place (the tabs), and the older filters still understood from old links.
    ["apartments", "kind=apartment", ["L1", "L4"]],
    ["houses", "kind=house", ["L2"]],
    ["rooms", "kind=room", ["L3", "L5"]],
    ["rooms (older link)", "type=ROOM_TO_SHARE", ["L3", "L5"]],
    ["studio (older link)", "propertyType=STUDIO", ["L4"]],
    ["private room", "kind=room&roomType=PRIVATE_ROOM", ["L3"]],
    ["shared room", "kind=room&roomType=SHARED_ROOM", ["L5"]],
    // Price.
    ["min price", "minPrice=1000", ["L2", "L3", "L4"]],
    ["max price", "maxPrice=1000", ["L1", "L5"]],
    ["min and max", "minPrice=1000&maxPrice=2000", ["L3", "L4"]],
    ["min above max is swapped", "minPrice=2000&maxPrice=1000", ["L3", "L4"]],
    ["typed with $ and a comma", `minPrice=${encodeURIComponent("$1,000")}&maxPrice=${encodeURIComponent("2,000")}`, ["L3", "L4"]],
    // People, rooms, size.
    ["2 people", "occupants=2", ["L1", "L2", "L4", "L5"]],
    ["4 people", "occupants=4", ["L2"]],
    ["5+ people", "occupants=5", ["L2"]],
    ["studio", "bedrooms=0", ["L4"]],
    ["1 bedroom", "bedrooms=1", ["L1", "L3"]],
    ["2 bedrooms", "bedrooms=2", ["L5"]],
    ["3+ bedrooms", "bedrooms=3%2B", ["L2"]],
    ["2+ bathrooms", "bathrooms=2", ["L2"]],
    ["750+ sq ft", "minSqft=750", ["L2", "L3"]],
    ["1,500+ sq ft", "minSqft=1500", ["L2"]],
    // When and how long.
    ["move in within a month", `moveIn=${iso(30)}`, ["L1", "L3", "L4", "L5"]],
    ["month-to-month", "lease=0", ["L1"]],
    ["6 months or less", "lease=6", ["L1", "L3"]],
    ["12 months or more", "lease=12", ["L2", "L4"]],
    // Each option.
    ["furnished", "amenities=furnished", ["L1"]],
    ["Wi-Fi", "amenities=internetIncluded", ["L1"]],
    ["utilities", "amenities=utilitiesIncluded", ["L3"]],
    ["private bathroom", "amenities=privateBathroom", ["L3"]],
    ["parking", "amenities=parking", ["L2"]],
    ["elevator", "amenities=elevator", ["L3"]],
    ["pets", "amenities=petsAllowed", ["L2"]],
    ["accessible", "amenities=accessible", ["L3"]],
    ["air conditioning", "amenities=airConditioning", ["L3"]],
    ["heat included", "amenities=heatIncluded", ["L3"]],
    ["dishwasher", "amenities=dishwasher", ["L3"]],
    ["two options together", "amenities=furnished,internetIncluded", ["L1"]],
    ["laundry", "laundry=1", ["L1", "L2"]],
    ["smoke-free", "smoking=free", ["L1"]],
    ["smoking allowed", "smoking=allowed", ["L2"]],
    ["no broker fee", "noBrokerFee=1", ["L1"]],
    ["no application fee", "noApplicationFee=1", ["L1"]],
    // How recent.
    ["last 24 hours", "listedWithin=1", ["L1", "L5"]],
    ["last 7 days", "listedWithin=7", ["L1", "L4", "L5"]],
    ["last 30 days", "listedWithin=30", ["L1", "L2", "L4", "L5"]],
    // Several at once.
    ["rooms under $1,000", "kind=room&maxPrice=1000", ["L5"]],
    ["apartments for 2 with 1 bedroom", "kind=apartment&occupants=2&bedrooms=1", ["L1"]],
  ];
  for (const [name, query, expected] of cases) {
    it(name, async () => {
      expect(sorted(await titles(query))).toEqual(sorted(expected));
    });
  }

  it("the place: city, neighborhood or ZIP code", async () => {
    const byHood = await search(request(`/api/listings/search?q=${encodeURIComponent(hood)}`));
    expect((await byHood.json()).listings.map((l: { id: string }) => l.id)).toEqual([ids.L4]);
  });

  it("sorts by price both ways and by newest", async () => {
    expect(await titles("sort=price_asc")).toEqual(["L5", "L1", "L3", "L4", "L2"]);
    expect(await titles("sort=price_desc")).toEqual(["L2", "L4", "L3", "L1", "L5"]);
    const newest = await titles("sort=newest");
    expect(newest.slice(2)).toEqual(["L4", "L2", "L3"]);
    expect(sorted(newest.slice(0, 2))).toEqual(["L1", "L5"]);
  });
});

describe("typed amounts (Fix F1)", () => {
  it("reads commas and dollar signs, refuses words and negatives", () => {
    expect(parseAmount("1,500")).toBe(1500);
    expect(parseAmount("$900")).toBe(900);
    expect(parseAmount(" 2000 ")).toBe(2000);
    expect(parseAmount("")).toBe(null);
    expect(parseAmount("abc")).toBe(null);
    expect(parseAmount("-500")).toBe(null);
  });
  it("puts min and max in order", () => {
    expect(orderedPrices(2000, 1000)).toEqual({ minPrice: 1000, maxPrice: 2000 });
    expect(orderedPrices(null, 1000)).toEqual({ minPrice: null, maxPrice: 1000 });
    expect(parseFilters(new URLSearchParams("minPrice=3000&maxPrice=1000"))).toMatchObject({ minPrice: 1000, maxPrice: 3000 });
  });
});
