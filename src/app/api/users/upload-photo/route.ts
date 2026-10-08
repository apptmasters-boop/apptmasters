import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";

// Profile photo: one file per user, named after the user id.
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const saved = await saveUpload(formData.get("file") as File | null, {
    kind: "image", folder: "avatars", maxBytes: 5 * 1024 * 1024, baseName: payload.userId,
  });
  if (!saved.ok) return saved.response;
  return NextResponse.json({ url: saved.url });
}
