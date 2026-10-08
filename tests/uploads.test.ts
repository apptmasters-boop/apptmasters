import { describe, it, expect } from "vitest";
import { unlink } from "fs/promises";
import { join } from "path";
import { NextRequest } from "next/server";
import { sniffFileType } from "@/lib/uploads";
import { POST as uploadAvatar } from "@/app/api/users/upload-photo/route";
import { POST as uploadAudio } from "@/app/api/upload/audio/route";
import { createUser } from "./helpers";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);
const TEXT = new TextEncoder().encode("<html><script>alert(1)</script></html>");

function upload(path: string, token: string, field: string, bytes: Uint8Array, name: string, type: string) {
  const form = new FormData();
  form.append(field, new File([Buffer.from(bytes)], name, { type }));
  return new NextRequest(`http://localhost${path}`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
}

describe("sniffFileType", () => {
  it("recognises real images and recordings by their content", () => {
    expect(sniffFileType(PNG)).toEqual({ kind: "image", ext: "png" });
    expect(sniffFileType(JPEG)).toEqual({ kind: "image", ext: "jpg" });
    expect(sniffFileType(WEBM)).toEqual({ kind: "audio", ext: "webm" });
  });

  it("rejects anything else, whatever it's called", () => {
    expect(sniffFileType(TEXT)).toBeNull();
    expect(sniffFileType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  });
});

describe("upload routes", () => {
  it("refuses a text file renamed to .jpg as a profile photo", async () => {
    const { token } = await createUser();
    const res = await uploadAvatar(upload("/api/users/upload-photo", token, "file", TEXT, "notes.jpg", "image/jpeg"));
    expect(res.status).toBe(400);
  });

  it("saves a real PNG with the extension of its real type", async () => {
    const { user, token } = await createUser();
    const res = await uploadAvatar(upload("/api/users/upload-photo", token, "file", PNG, "photo.jpg", "image/jpeg"));
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(url).toBe(`/uploads/avatars/${user.id}.png`);
    await unlink(join(process.cwd(), "public", url)).catch(() => {});
  });

  it("refuses an image sent as a voice message", async () => {
    const { token } = await createUser();
    const res = await uploadAudio(upload("/api/upload/audio", token, "audio", PNG, "voice.webm", "audio/webm"));
    expect(res.status).toBe(400);
  });
});
