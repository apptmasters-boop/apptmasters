import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, signStreamTicket } from "@/lib/auth";

// Exchanges the login token (sent as a header) for a 60-second stream ticket
// that can go in an EventSource URL. See signStreamTicket in src/lib/auth.ts.
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ticket: signStreamTicket(payload) });
}
