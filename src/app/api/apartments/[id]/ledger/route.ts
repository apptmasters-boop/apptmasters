import { NextRequest, NextResponse } from "next/server";
import { requireApartmentMember } from "@/lib/access";
import { ledgerEntries, netDebts, fundBalance } from "@/lib/ledger";

/**
 * The household's Money ledger (Sprint 5): every entry, and who owes whom with
 * rent included. Read-only; the new Money page (5b) is built on it.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: apartmentId } = await params;
  const access = await requireApartmentMember(req, apartmentId);
  if (!access.ok) return access.response;

  const entries = await ledgerEntries(apartmentId);
  return NextResponse.json({
    entries: entries.map(({ cents, ...e }) => ({ ...e, amount: cents / 100 })),
    debts: netDebts(entries),
    fundBalance: fundBalance(entries),
  });
}
