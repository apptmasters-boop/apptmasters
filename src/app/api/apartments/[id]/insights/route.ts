import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { householdInsights } from "@/lib/insights";

/** More → Insights (PRODUCT_LOGIC §19): household numbers from the same sources as Money and Household. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  return NextResponse.json({ me: access.userId, ...(await householdInsights(apartmentId, access.userId)) });
}
