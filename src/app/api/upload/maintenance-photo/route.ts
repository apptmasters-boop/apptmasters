import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

// Photo of a problem, attached when reporting a maintenance request.
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const saved = await saveUpload(formData.get("photo") as File | null, { kind: "image", folder: "maintenance", maxBytes: 10 * 1024 * 1024 });
  if (!saved.ok) return saved.response;
  return NextResponse.json({ url: saved.url });
}
