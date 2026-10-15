/**
 * Sprint 8a: the maintenance steps (PRODUCT_LOGIC §14). Reported → Acknowledged
 * → Scheduled → In progress → Completed, moved by the linked landlord or, when
 * there is none, household admins (owner's decision, 2026-10-15).
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as listRoute, POST as reportRoute } from "@/app/api/apartments/[id]/maintenance/route";
import { POST as progressRoute } from "@/app/api/apartments/[id]/maintenance/[requestId]/progress/route";
import { PATCH as landlordRoute } from "@/app/api/manager/maintenance/[requestId]/route";
import { POST as confirmRoute } from "@/app/api/apartments/[id]/maintenance/[requestId]/confirm/route";
import { POST as uploadPhoto } from "@/app/api/upload/maintenance-photo/route";
import { buildHomeFeed } from "@/lib/homeFeed";
import { visitWindow } from "@/lib/maintenance";
import { prisma } from "@/lib/db";
import { createUser, createApartment, request, routeParams } from "./helpers";

const PHOTO = "/uploads/maintenance/0b5f8d3e-1c2a-4c55-9d7e-2f6a1b3c4d5e.jpg";

/** Alex is the household admin; Sam reports problems. No landlord linked. */
async function household() {
  const alex = await createUser();
  const sam = await createUser();
  const apt = await createApartment(alex.user.id);
  await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: sam.user.id } });
  return { alex, sam, apt };
}
const report = (token: string, aptId: string, body: object) =>
  reportRoute(request("/x", { method: "POST", token, body }), routeParams({ id: aptId }));
const list = async (token: string, aptId: string) =>
  (await listRoute(request("/x", { token }), routeParams({ id: aptId }))).json();
const progress = (token: string, aptId: string, requestId: string, body: object) =>
  progressRoute(request("/x", { method: "POST", token, body }), routeParams({ id: aptId, requestId }));
/** Tomorrow at `hourUtc`:00 UTC. */
const tomorrowAt = (hourUtc: number) => {
  const d = new Date(Date.now() + 86_400_000);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};
async function reported(token: string, aptId: string, extra: object = {}) {
  return (await report(token, aptId, { title: "Leaking faucet", description: "Drips all night", location: "Bathroom", priority: "URGENT", ...extra })).json();
}

describe("reporting a problem", () => {
  it("records where it is and a photo, starts the timeline, and tells household admins", async () => {
    const { alex, sam, apt } = await household();
    const res = await report(sam.token, apt.id, { title: "Leaking faucet", description: "Drips all night", location: "Bathroom", priority: "URGENT", photo: PHOTO });
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ status: "REPORTED", location: "Bathroom", photo: PHOTO });

    const forAdmin = await list(alex.token, apt.id);
    expect(forAdmin.canUpdate).toBe("HOUSEHOLD");
    expect(forAdmin.landlord).toBeNull();
    const r = forAdmin.requests.find((x: { id: string }) => x.id === created.id);
    expect(r.updates).toEqual([expect.objectContaining({ status: "REPORTED", byRole: "RESIDENT" })]);
    expect(r.next).toEqual(["ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"]);

    const forSam = await list(sam.token, apt.id);
    expect(forSam.canUpdate).toBeNull();
    expect(forSam.requests[0].next).toEqual([]);

    expect(await prisma.notification.count({ where: { userId: alex.user.id, type: "MAINTENANCE_REPORTED" } })).toBe(1);
  });

  it("only accepts photos uploaded through the app, and real images", async () => {
    const { sam, apt } = await household();
    expect((await report(sam.token, apt.id, { title: "x", description: "y", photo: "https://evil.example/x.jpg" })).status).toBe(400);
    const form = new FormData();
    form.append("photo", new File([Buffer.from("<html>not an image</html>")], "photo.jpg", { type: "image/jpeg" }));
    const res = await uploadPhoto(new NextRequest("http://localhost/api/upload/maintenance-photo", { method: "POST", headers: { authorization: `Bearer ${sam.token}` }, body: form }));
    expect(res.status).toBe(400);
  });

  it("requests saved before as 'Open' show as 'Reported'", async () => {
    const { alex, sam, apt } = await household();
    await prisma.maintenanceRequest.create({ data: { apartmentId: apt.id, submittedById: sam.user.id, title: "Old", description: "From before", status: "OPEN" } });
    const r = (await list(alex.token, apt.id)).requests[0];
    expect(r.status).toBe("REPORTED");
    expect(r.next).toContain("ACKNOWLEDGED");
  });
});

describe("moving a request along (no landlord linked: household admins)", () => {
  it("only household admins update; steps only go forward; the reporter is told", async () => {
    const { alex, sam, apt } = await household();
    const r = await reported(sam.token, apt.id);
    expect((await progress(sam.token, apt.id, r.id, { status: "ACKNOWLEDGED" })).status).toBe(403);

    expect((await progress(alex.token, apt.id, r.id, { status: "ACKNOWLEDGED", note: "Landlord will send a plumber" })).status).toBe(200);
    const note = await prisma.notification.findFirst({ where: { userId: sam.user.id, type: "MAINTENANCE_UPDATED" } });
    expect(note).toMatchObject({ title: "Leaking faucet: Acknowledged", body: "Landlord will send a plumber" });

    expect((await progress(alex.token, apt.id, r.id, { status: "REPORTED" })).status).toBe(409); // no going back
    expect((await progress(alex.token, apt.id, r.id, { status: "RESOLVED" })).status).toBe(409); // that's the resident's (8b)
    const timeline = (await list(alex.token, apt.id)).requests[0].updates;
    expect(timeline.map((u: { status: string; byRole: string }) => [u.status, u.byRole])).toEqual([["REPORTED", "RESIDENT"], ["ACKNOWLEDGED", "HOUSEHOLD"]]);
  });

  it("scheduling puts the visit on the calendar, tells everyone, and moves it when rescheduled", async () => {
    const { alex, sam, apt } = await household();
    const r = await reported(sam.token, apt.id);
    expect((await progress(alex.token, apt.id, r.id, { status: "SCHEDULED" })).status).toBe(400); // no time
    expect((await progress(alex.token, apt.id, r.id, { status: "SCHEDULED", scheduledStart: tomorrowAt(16), scheduledEnd: tomorrowAt(14) })).status).toBe(400);

    const res = await progress(alex.token, apt.id, r.id, { status: "SCHEDULED", scheduledStart: tomorrowAt(14), scheduledEnd: tomorrowAt(16), timeZone: "UTC", note: "Someone must be home" });
    expect(res.status).toBe(200);
    const events = await prisma.calendarEvent.findMany({ where: { apartmentId: apt.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "MAINTENANCE", title: "Repair: Leaking faucet", allDay: false });
    const told = await prisma.notification.findFirst({ where: { userId: sam.user.id, type: "MAINTENANCE_SCHEDULED" } });
    expect(told?.body).toContain("2:00 PM – 4:00 PM UTC. Someone must be home");

    // Rescheduling moves the same event.
    expect((await progress(alex.token, apt.id, r.id, { status: "SCHEDULED", scheduledStart: tomorrowAt(9), scheduledEnd: tomorrowAt(11) })).status).toBe(200);
    const moved = await prisma.calendarEvent.findMany({ where: { apartmentId: apt.id } });
    expect(moved).toHaveLength(1);
    expect(moved[0].startDate.toISOString()).toBe(tomorrowAt(9));

    // Home: the urgent repair says a visit is scheduled, and the visit is coming up.
    const feed = await buildHomeFeed(apt.id, sam.user.id, "MEMBER");
    expect(feed.find(i => i.id === `maintenance:${r.id}`)?.detail).toBe("Repair visit scheduled");
    expect(feed.some(i => i.id === `event:${moved[0].id}`)).toBe(true);
  });

  it("completed repairs leave the top of Home; admins see new reports to pass on", async () => {
    const { alex, sam, apt } = await household();
    const r = await reported(sam.token, apt.id);
    expect((await buildHomeFeed(apt.id, alex.user.id, "ADMIN")).find(i => i.id === `maintenance-tell:${r.id}`)?.title).toBe("Tell the landlord: Leaking faucet");
    expect((await buildHomeFeed(apt.id, sam.user.id, "MEMBER")).some(i => i.id.startsWith("maintenance-tell:"))).toBe(false);

    await progress(alex.token, apt.id, r.id, { status: "IN_PROGRESS" });
    expect((await buildHomeFeed(apt.id, alex.user.id, "ADMIN")).some(i => i.id === `maintenance-tell:${r.id}`)).toBe(false);
    expect((await progress(alex.token, apt.id, r.id, { status: "COMPLETED" })).status).toBe(200);
    expect((await prisma.maintenanceRequest.findUnique({ where: { id: r.id } }))?.completedAt).not.toBeNull();
    expect((await buildHomeFeed(apt.id, sam.user.id, "MEMBER")).some(i => i.id === `maintenance:${r.id}`)).toBe(false);
    expect((await list(alex.token, apt.id)).requests[0].next).toEqual([]);
  });
});

describe("with a landlord linked to the home", () => {
  it("the landlord moves requests in their portal; household admins no longer do", async () => {
    const { alex, sam, apt } = await household();
    const landlord = await createUser({ systemRole: "MANAGER" });
    const otherLandlord = await createUser({ systemRole: "MANAGER" });
    await prisma.apartment.update({ where: { id: apt.id }, data: { managerId: landlord.user.id } });
    const r = await reported(sam.token, apt.id);

    expect((await list(alex.token, apt.id)).canUpdate).toBeNull();
    expect((await progress(alex.token, apt.id, r.id, { status: "ACKNOWLEDGED" })).status).toBe(403);
    expect((await buildHomeFeed(apt.id, alex.user.id, "ADMIN")).some(i => i.id.startsWith("maintenance-tell:"))).toBe(false);

    const patch = (token: string, body: object) => landlordRoute(request("/x", { method: "PATCH", token, body }), routeParams({ requestId: r.id }));
    expect((await patch(otherLandlord.token, { status: "ACKNOWLEDGED" })).status).toBe(403);
    expect((await patch(sam.token, { status: "ACKNOWLEDGED" })).status).toBe(403);
    expect((await patch(landlord.token, { status: "ACKNOWLEDGED", note: "On it" })).status).toBe(200);
    expect((await patch(landlord.token, { landlordNote: "Parts ordered" })).status).toBe(200); // a note on the current step
    const timeline = (await list(sam.token, apt.id)).requests[0].updates;
    expect(timeline.map((u: { status: string; byRole: string; note: string | null }) => [u.status, u.byRole, u.note])).toEqual([
      ["REPORTED", "RESIDENT", null], ["ACKNOWLEDGED", "LANDLORD", "On it"], ["ACKNOWLEDGED", "LANDLORD", "Parts ordered"],
    ]);
  });
});

describe("visit times in messages", () => {
  it("uses the scheduler's time zone, or UTC when it's unknown", () => {
    const start = new Date("2026-11-20T15:00:00Z");
    const end = new Date("2026-11-20T17:00:00Z");
    expect(visitWindow(start, end, "America/New_York")).toBe("Fri, Nov 20, 10:00 AM – 12:00 PM");
    expect(visitWindow(start, end, "Not/AZone")).toBe("Fri, Nov 20, 3:00 PM – 5:00 PM UTC");
  });
});

describe("Sprint 8b: Is it fixed?", () => {
  const confirm = (token: string, aptId: string, requestId: string, body: object) =>
    confirmRoute(request("/x", { method: "POST", token, body }), routeParams({ id: aptId, requestId }));

  it("asks only after Completed, and only the person who reported it; fixed → Resolved", async () => {
    const { alex, sam, apt } = await household();
    const kim = await createUser();
    await prisma.apartmentMember.create({ data: { apartmentId: apt.id, userId: kim.user.id } });
    const r = await reported(sam.token, apt.id);
    expect((await confirm(sam.token, apt.id, r.id, { fixed: true })).status).toBe(409); // not completed yet

    await progress(alex.token, apt.id, r.id, { status: "COMPLETED" });
    expect((await confirm(kim.token, apt.id, r.id, { fixed: true })).status).toBe(403); // didn't report it
    expect((await confirm(alex.token, apt.id, r.id, { fixed: true })).status).toBe(403); // admin, but the reporter still lives here
    expect((await list(sam.token, apt.id)).requests[0].canConfirm).toBe(true);
    expect((await list(alex.token, apt.id)).requests[0].canConfirm).toBe(false);
    expect((await buildHomeFeed(apt.id, sam.user.id, "MEMBER")).find(i => i.id === `maintenance-fixed:${r.id}`)?.title).toBe("Is it fixed? Leaking faucet");
    expect((await buildHomeFeed(apt.id, kim.user.id, "MEMBER")).some(i => i.id.startsWith("maintenance-fixed:"))).toBe(false);

    expect((await confirm(sam.token, apt.id, r.id, { fixed: true })).status).toBe(200);
    const after = await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: r.id } });
    expect(after.status).toBe("RESOLVED");
    expect(after.resolvedAt).not.toBeNull();
    const timeline = (await list(sam.token, apt.id)).requests[0].updates;
    expect(timeline.at(-1)).toMatchObject({ status: "RESOLVED", byRole: "RESIDENT" });
    expect(await prisma.notification.count({ where: { userId: alex.user.id, type: "MAINTENANCE_RESOLVED" } })).toBe(1);
    expect((await buildHomeFeed(apt.id, sam.user.id, "MEMBER")).some(i => i.id.startsWith("maintenance-fixed:"))).toBe(false);
    expect((await confirm(sam.token, apt.id, r.id, { fixed: true })).status).toBe(409); // already answered
  });

  it("still a problem needs a note, goes back to Reported with the old visit cleared, and the admins pass it on again", async () => {
    const { alex, sam, apt } = await household();
    const r = await reported(sam.token, apt.id);
    await progress(alex.token, apt.id, r.id, { status: "SCHEDULED", scheduledStart: tomorrowAt(14), scheduledEnd: tomorrowAt(16) });
    await progress(alex.token, apt.id, r.id, { status: "COMPLETED" });

    expect((await confirm(sam.token, apt.id, r.id, { fixed: false })).status).toBe(400);
    expect((await confirm(sam.token, apt.id, r.id, { fixed: false, note: "Still drips at night" })).status).toBe(200);
    expect(await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      status: "REPORTED", completedAt: null, scheduledStart: null, calendarEventId: null, residentFeedback: "Still drips at night",
    });
    const last = (await list(alex.token, apt.id)).requests[0].updates.at(-1);
    expect(last).toMatchObject({ status: "REOPENED", byRole: "RESIDENT", note: "Still drips at night" });
    expect(await prisma.notification.count({ where: { userId: alex.user.id, type: "MAINTENANCE_REOPENED" } })).toBe(1);
    expect((await buildHomeFeed(apt.id, alex.user.id, "ADMIN")).some(i => i.id === `maintenance-tell:${r.id}`)).toBe(true);

    // The next visit gets its own calendar entry; the first one stays as history.
    await progress(alex.token, apt.id, r.id, { status: "SCHEDULED", scheduledStart: tomorrowAt(9), scheduledEnd: tomorrowAt(10) });
    expect(await prisma.calendarEvent.count({ where: { apartmentId: apt.id } })).toBe(2);
  });

  it("a household admin answers once the reporter has moved out", async () => {
    const { alex, sam, apt } = await household();
    const r = await reported(sam.token, apt.id);
    await progress(alex.token, apt.id, r.id, { status: "COMPLETED" });
    await prisma.apartmentMember.updateMany({ where: { apartmentId: apt.id, userId: sam.user.id }, data: { status: "MOVED_OUT" } });
    expect((await list(alex.token, apt.id)).requests[0].canConfirm).toBe(true);
    expect((await confirm(alex.token, apt.id, r.id, { fixed: true })).status).toBe(200);
  });

  it("a linked landlord is emailed the answer and sees the resident's note", async () => {
    const { sam, apt } = await household();
    const landlord = await createUser({ systemRole: "MANAGER" });
    await prisma.apartment.update({ where: { id: apt.id }, data: { managerId: landlord.user.id } });
    const r = await reported(sam.token, apt.id);
    await landlordRoute(request("/x", { method: "PATCH", token: landlord.token, body: { status: "COMPLETED" } }), routeParams({ requestId: r.id }));

    const sent = (globalThis as unknown as { sentEmails: { to: string; subject: string }[] }).sentEmails;
    const before = sent.length;
    expect((await confirm(sam.token, apt.id, r.id, { fixed: false, note: "Worse than before" })).status).toBe(200);
    expect(sent.slice(before)).toContainEqual(expect.objectContaining({ to: landlord.user.email, subject: "Still a problem: Leaking faucet" }));
    expect((await prisma.maintenanceRequest.findUniqueOrThrow({ where: { id: r.id } })).residentFeedback).toBe("Worse than before");
  });
});
