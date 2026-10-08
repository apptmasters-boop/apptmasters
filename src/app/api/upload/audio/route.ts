import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

// Voice messages recorded in the browser (WebM/Opus, or MP4 on Safari).
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const saved = await saveUpload(formData.get("audio") as File | null, { kind: "audio", folder: "audio", maxBytes: 10 * 1024 * 1024 });
  if (!saved.ok) return saved.response;
  return NextResponse.json({ url: saved.url });
}
