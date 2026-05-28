import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTokenFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyApartment } from "@/lib/notify";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  cleanlinessStatus: z.enum(["CLEAN", "NEEDS_ATTENTION", "DIRTY"]).optional(),
  maintenanceFlag: z.boolean().optional(),
  maintenanceNotes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, roomId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existingRoom = await prisma.room.findFirst({ where: { id: roomId, apartmentId } });
  if (!existingRoom) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const room = await prisma.room.update({ where: { id: roomId }, data: parsed.data });

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { name: true } });
  const actor = user?.name ?? "Someone";

  if (parsed.data.maintenanceFlag !== undefined) {
    if (parsed.data.maintenanceFlag && !existingRoom.maintenanceFlag) {
      await notifyApartment(
        apartmentId,
        payload.userId,
        "MAINTENANCE_FLAGGED",
        "Maintenance needed",
        `${actor} flagged ${existingRoom.name} for maintenance.`,
        `/apartment/${apartmentId}/rooms`,
      );
    } else if (!parsed.data.maintenanceFlag && existingRoom.maintenanceFlag) {
      await notifyApartment(
        apartmentId,
        payload.userId,
        "MAINTENANCE_RESOLVED",
        "Maintenance cleared",
        `${actor} cleared the maintenance flag for ${existingRoom.name}.`,
        `/apartment/${apartmentId}/rooms`,
      );
    }
  }

  if (parsed.data.cleanlinessStatus !== undefined && parsed.data.cleanlinessStatus !== existingRoom.cleanlinessStatus) {
    const status = parsed.data.cleanlinessStatus;
    const statusMeta = {
      CLEAN: ["ROOM_CLEAN", "Room cleaned", `${actor} marked ${existingRoom.name} as clean.`],
      DIRTY: ["ROOM_DIRTY", "Room marked dirty", `${actor} marked ${existingRoom.name} as dirty.`],
      NEEDS_ATTENTION: ["ROOM_NEEDS_ATTENTION", "Room needs attention", `${actor} marked ${existingRoom.name} as needing attention.`],
    } as const;

    const [type, title, body] = statusMeta[status];
    await notifyApartment(
      apartmentId,
      payload.userId,
      type,
      title,
      body,
      `/apartment/${apartmentId}/rooms`,
    );
  }

  if (parsed.data.maintenanceNotes !== undefined && parsed.data.maintenanceNotes !== existingRoom.maintenanceNotes) {
    await notifyApartment(
      apartmentId,
      payload.userId,
      "MAINTENANCE_NOTE_UPDATED",
      "Maintenance note updated",
      `${actor} updated maintenance notes for ${existingRoom.name}.`,
      `/apartment/${apartmentId}/rooms`,
    );
  }

  return NextResponse.json(room);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: apartmentId, roomId } = await params;
  const membership = await prisma.apartmentMember.findUnique({
    where: { userId_apartmentId: { userId: payload.userId, apartmentId } },
  });
  if (!membership || membership.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.room.delete({ where: { id: roomId } });
  return NextResponse.json({ success: true });
}
