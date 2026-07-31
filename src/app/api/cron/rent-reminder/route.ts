import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayDate = now.getDate();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const configs = await prisma.rentConfig.findMany({
    where: {
      rentPayerId: { not: null },
      dueDay: { in: [todayDate, todayDate + 3] },
    },
    include: { apartment: { select: { name: true } } },
  });

  let headsUp = 0;
  let dueToday = 0;

  for (const config of configs) {
    const existingCycle = await prisma.rentCycle.findUnique({
      where: { apartmentId_month: { apartmentId: config.apartmentId, month: currentMonth } },
    });
    if (existingCycle) continue;

    const isDueToday = config.dueDay === todayDate;
    const amount = config.totalAmount.toFixed(2);
    const title = isDueToday ? "Rent due today" : "Rent due soon";
    const body = isDueToday
      ? `Your rent of $${amount} is due today for ${config.apartment.name}. Log it in the app once you've paid your landlord.`
      : `Your rent of $${amount} is due in 3 days for ${config.apartment.name}.`;

    await notify({
      apartmentId: config.apartmentId,
      userIds: [config.rentPayerId!],
      type: "RENT_REMINDER",
      title,
      body,
      link: `/apartment/${config.apartmentId}/rent`,
      sendEmailTo: [config.rentPayerId!],
    });

    if (isDueToday) dueToday++;
    else headsUp++;
  }

  return NextResponse.json({ headsUp, dueToday });
}
