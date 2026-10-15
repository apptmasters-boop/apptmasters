import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { prisma } from "@/lib/db";
import { currentMonth, monthLabel, rentDueDate, rentMonths, ensureRentMonths, startsOn } from "@/lib/rent";

/**
 * Money → Rent (PRODUCT_LOGIC §12): the setup, this month's summary (landlord
 * paid vs. roommates reimbursed) and every month for the history, newest first.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  await ensureRentMonths(apartmentId); // the month coming due starts by itself (Sprint 7b)
  const config = await prisma.rentConfig.findUnique({ where: { apartmentId } });
  const isAdmin = access.membership.role === "ADMIN";
  const month = currentMonth();
  if (!config) {
    return NextResponse.json({ me: access.userId, isAdmin, config: null, thisMonth: month, thisMonthLabel: monthLabel(month), months: [] });
  }

  const [months, payer] = await Promise.all([
    rentMonths(apartmentId, config.dueDay),
    config.rentPayerId ? prisma.user.findUnique({ where: { id: config.rentPayerId }, select: { id: true, name: true } }) : null,
  ]);
  const isRentPayer = config.rentPayerId === access.userId;
  return NextResponse.json({
    me: access.userId,
    isAdmin,
    config: {
      totalAmount: config.totalAmount, dueDay: config.dueDay, landlordName: config.landlordName,
      rentPayer: payer, shares: JSON.parse(config.shares || "{}"), autoRotate: config.autoRotate,
    },
    thisMonth: month,
    thisMonthLabel: monthLabel(month),
    thisMonthDue: rentDueDate(month, config.dueDay).toISOString().slice(0, 10),
    /** When this month starts by itself (3 days before it's due), if that's still ahead. */
    thisMonthStartsOn: startsOn(month, config.dueDay) > new Date().toISOString().slice(0, 10) ? startsOn(month, config.dueDay) : null,
    /** The rent payer and admins can also start this month early, before it starts by itself. */
    canStartMonth: (isRentPayer || isAdmin) && !!config.rentPayerId && !months.some(m => m.month === month),
    months,
  });
}
