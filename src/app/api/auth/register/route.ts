import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Registration is currently closed. Please check back later." },
    { status: 503 }
  );
}
