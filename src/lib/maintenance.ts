/**
 * Maintenance workflow (docs/PRODUCT_LOGIC.md §14):
 *
 *   REPORTED → ACKNOWLEDGED → SCHEDULED → IN_PROGRESS → COMPLETED → RESOLVED
 *
 * The landlord side moves a request along: the home's linked landlord
 * (Apartment.managerId) in their portal, or, when no landlord is linked,
 * household admins recording the landlord's answers (owner's decision,
 * 2026-10-15). Steps only go forward; a visit can be rescheduled, and work in
 * progress can need another visit. Every step is kept on the request's
 * timeline (MaintenanceUpdate). Scheduling a visit puts it on the household
 * calendar and tells everyone at home.
 */
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { sendEmail, notificationEmail, appUrl } from "@/lib/email";

export const STEP_LABEL: Record<string, string> = {
  REPORTED: "Reported", ACKNOWLEDGED: "Acknowledged", SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress", COMPLETED: "Completed", RESOLVED: "Resolved",
  // Timeline only: the resident said it isn't fixed, and it went back to "Reported" (Sprint 8b).
  REOPENED: "Still a problem",
};

/** Requests saved before Sprint 8 said "OPEN"; that's "REPORTED" now. */
export const currentStep = (status: string) => (status === "OPEN" ? "REPORTED" : status);

/** Where the landlord side can take a request from each step. */
const NEXT: Record<string, string[]> = {
  REPORTED: ["ACKNOWLEDGED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"],
  ACKNOWLEDGED: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"],
  SCHEDULED: ["SCHEDULED", "IN_PROGRESS", "COMPLETED"], // rescheduling is a new SCHEDULED step
  IN_PROGRESS: ["SCHEDULED", "COMPLETED"],              // another visit may be needed
  COMPLETED: [],
  RESOLVED: [],
};
export const nextSteps = (status: string) => NEXT[currentStep(status)] ?? [];

/** The request is still waiting for the landlord side (not completed or resolved). */
export const isOpen = (status: string) => !["COMPLETED", "RESOLVED"].includes(currentStep(status));

export type UpdaterRole = "LANDLORD" | "HOUSEHOLD";

/**
 * Who may move this home's requests along, for this user: the linked landlord,
 * or, when there is none, household admins. Null for everyone else.
 */
export async function updaterRole(apartmentId: string, userId: string, memberRole?: string): Promise<UpdaterRole | null> {
  const home = await prisma.apartment.findUnique({ where: { id: apartmentId }, select: { managerId: true } });
  if (!home) return null;
  if (home.managerId) return home.managerId === userId ? "LANDLORD" : null;
  return memberRole === "ADMIN" ? "HOUSEHOLD" : null;
}

export class MaintenanceError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

/** "Fri, Oct 17, 2:00 PM – 4:00 PM" in the time zone of the person who scheduled it. */
export function visitWindow(start: Date, end: Date, timeZone?: string | null) {
  let zone = "UTC";
  if (timeZone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone }); zone = timeZone; } catch { /* unknown zone: fall back to UTC */ }
  }
  const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: zone });
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone });
  return `${day}, ${time(start)} – ${time(end)}${zone === "UTC" ? " UTC" : ""}`;
}

const HOUR = 3_600_000;

/**
 * Moves a request to `status` (or adds a note, or a new visit time, on the
 * current step) for the landlord side, records it on the timeline, keeps the
 * calendar event in step and tells the right people.
 */
export async function advanceMaintenance(requestId: string, actor: { userId: string; role: UpdaterRole }, input: {
  status: string; note?: string | null; scheduledStart?: string | Date | null; scheduledEnd?: string | Date | null; timeZone?: string | null;
}, now = new Date()) {
  const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new MaintenanceError("Request not found", 404);
  const from = currentStep(request.status);
  const to = input.status;
  const note = input.note?.trim().slice(0, 500) || null;
  const justANote = to === from && to !== "SCHEDULED";
  if (justANote ? !note || !isOpen(from) : !nextSteps(from).includes(to)) {
    throw new MaintenanceError(`A request that is ${STEP_LABEL[from]?.toLowerCase() ?? from} can't be marked ${STEP_LABEL[to]?.toLowerCase() ?? to}`, 409);
  }

  let start: Date | null = null;
  let end: Date | null = null;
  if (to === "SCHEDULED") {
    start = input.scheduledStart ? new Date(input.scheduledStart) : null;
    end = input.scheduledEnd ? new Date(input.scheduledEnd) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new MaintenanceError("Choose the visit's date and a time window that ends after it starts");
    }
    if (start.getTime() < now.getTime() - 24 * HOUR || start.getTime() > now.getTime() + 366 * 24 * HOUR || end.getTime() - start.getTime() > 24 * HOUR) {
      throw new MaintenanceError("The visit must be within the next year, and last at most a day");
    }
  }

  const updated = await prisma.$transaction(async tx => {
    let calendarEventId = request.calendarEventId;
    if (start && end) {
      const event = { title: `Repair: ${request.title}`, startDate: start, endDate: end, allDay: false, notes: request.location ? `Where: ${request.location}` : null };
      const existing = calendarEventId ? await tx.calendarEvent.findUnique({ where: { id: calendarEventId } }) : null;
      calendarEventId = existing
        ? (await tx.calendarEvent.update({ where: { id: existing.id }, data: event })).id
        : (await tx.calendarEvent.create({ data: { ...event, type: "MAINTENANCE", apartmentId: request.apartmentId, userId: actor.userId } })).id;
    }
    await tx.maintenanceUpdate.create({
      data: { requestId, status: to, note, byRole: actor.role, byUserId: actor.userId, scheduledStart: start, scheduledEnd: end },
    });
    return tx.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: to,
        ...(note ? { landlordNote: note } : {}),
        ...(start && end ? { scheduledStart: start, scheduledEnd: end, calendarEventId } : {}),
        ...(to === "COMPLETED" ? { completedAt: now } : {}),
      },
    });
  });

  // Tell people. A visit concerns everyone at home (someone may need to let them in); other steps, the reporter.
  const link = `/apartment/${request.apartmentId}/maintenance`;
  if (start && end) {
    const members = await prisma.apartmentMember.findMany({
      where: { apartmentId: request.apartmentId, status: { in: ["ACTIVE", "VACATION"] }, userId: { not: actor.userId } },
      select: { userId: true },
    });
    const ids = members.map(m => m.userId);
    await notify({
      apartmentId: request.apartmentId, userIds: ids, sendEmailTo: ids, type: "MAINTENANCE_SCHEDULED", link, important: true,
      title: `Repair visit: ${request.title}`,
      body: `${visitWindow(start, end, input.timeZone)}${note ? `. ${note}` : ""}`,
    });
  } else if (request.submittedById !== actor.userId) {
    const stillHere = await prisma.apartmentMember.count({ where: { apartmentId: request.apartmentId, userId: request.submittedById, status: { not: "MOVED_OUT" } } });
    if (stillHere) {
      await notify({
        apartmentId: request.apartmentId, userIds: [request.submittedById], sendEmailTo: [request.submittedById],
        type: "MAINTENANCE_UPDATED", link,
        title: justANote ? `New note on "${request.title}"` : `${request.title}: ${STEP_LABEL[to]}`,
        body: note ?? (to === "COMPLETED" ? "The landlord says the repair is done." : `The request is now ${STEP_LABEL[to].toLowerCase()}.`),
      });
    }
  }
  return updated;
}

// ---------------------------------------------------------------------------
// "Is it fixed?" (Sprint 8b, §14.5): after the landlord side says Completed,
// the resident who reported it confirms, so "completed" never silently means
// "fixed".

/**
 * Who answers for a completed request: the person who reported it; a household
 * admin only once the reporter has moved out. `activeMembers`: the ids of
 * people living in the home now.
 */
export function canConfirmFix(request: { status: string; submittedById: string }, userId: string, memberRole: string | undefined, activeMembers: Set<string>) {
  if (currentStep(request.status) !== "COMPLETED") return false;
  if (request.submittedById === userId) return true;
  return memberRole === "ADMIN" && !activeMembers.has(request.submittedById);
}

/** Ids of people living in the home now (not moved out, not waiting to be approved). */
export async function activeMemberIds(apartmentId: string) {
  const members = await prisma.apartmentMember.findMany({ where: { apartmentId, status: { in: ["ACTIVE", "VACATION"] } }, select: { userId: true } });
  return new Set(members.map(m => m.userId));
}

/**
 * The resident's answer. Fixed → RESOLVED. Still a problem (with a note) →
 * back to REPORTED: the landlord side starts again, and the old visit is
 * cleared so a new one gets its own calendar entry. The landlord side is told
 * either way: the linked landlord by email, otherwise household admins.
 */
export async function confirmFix(requestId: string, user: { userId: string; memberRole?: string }, answer: { fixed: boolean; note?: string | null }, now = new Date()) {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: requestId },
    include: { apartment: { select: { manager: { select: { id: true, email: true } } } } },
  });
  if (!request) throw new MaintenanceError("Request not found", 404);
  if (currentStep(request.status) !== "COMPLETED") throw new MaintenanceError("Only a repair marked completed can be confirmed", 409);
  if (!canConfirmFix(request, user.userId, user.memberRole, await activeMemberIds(request.apartmentId))) {
    throw new MaintenanceError("Only the person who reported it can answer (or a household admin, once they've moved out)", 403);
  }
  const note = answer.note?.trim().slice(0, 500) || null;
  if (!answer.fixed && !note) throw new MaintenanceError("Say what's still wrong, so the landlord knows");

  const updated = await prisma.$transaction(async tx => {
    // Only if nobody answered in the meantime.
    const { count } = await tx.maintenanceRequest.updateMany({
      where: { id: requestId, status: "COMPLETED" },
      data: answer.fixed
        ? { status: "RESOLVED", resolvedAt: now }
        : { status: "REPORTED", completedAt: null, scheduledStart: null, scheduledEnd: null, calendarEventId: null, residentFeedback: note },
    });
    if (count === 0) throw new MaintenanceError("Someone already answered", 409);
    await tx.maintenanceUpdate.create({
      data: { requestId, status: answer.fixed ? "RESOLVED" : "REOPENED", note, byRole: "RESIDENT", byUserId: user.userId },
    });
    return tx.maintenanceRequest.findUniqueOrThrow({ where: { id: requestId } });
  });

  // Tell the landlord side.
  const who = (await prisma.user.findUnique({ where: { id: user.userId }, select: { name: true } }))?.name ?? "A resident";
  const title = answer.fixed ? `Fixed: ${request.title}` : `Still a problem: ${request.title}`;
  const body = answer.fixed ? `${who} confirmed the repair worked.` : `${who} says it isn't fixed: ${note}`;
  const manager = request.apartment.manager;
  if (manager?.email) {
    await sendEmail(manager.email, title, notificationEmail(title, body, `${appUrl}/manager`, "Open the manager portal"));
  } else {
    const admins = await prisma.apartmentMember.findMany({
      where: { apartmentId: request.apartmentId, role: "ADMIN", status: "ACTIVE", userId: { not: user.userId } },
      select: { userId: true },
    });
    await notify({
      apartmentId: request.apartmentId, userIds: admins.map(a => a.userId), link: `/apartment/${request.apartmentId}/maintenance`,
      type: answer.fixed ? "MAINTENANCE_RESOLVED" : "MAINTENANCE_REOPENED",
      title, body: answer.fixed ? body : `${body} Tell the landlord again, then record their answer.`,
    });
  }
  return updated;
}
