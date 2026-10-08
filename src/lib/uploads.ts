/**
 * Shared checks for user uploads (photos, voice messages).
 *
 * The browser-supplied file type and name are just claims, so we look at the
 * first bytes of the file itself (every real JPEG/PNG/… starts with a known
 * "signature") and pick the saved file's extension from that. nginx serves
 * /uploads/ by extension, so a renamed HTML or script file can never be saved
 * as something a browser would run. SVG is deliberately not accepted (it can
 * contain scripts).
 */
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export type UploadKind = "image" | "audio";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));

/** The real type of a file from its first bytes, or null if it's not one we accept. */
export function sniffFileType(b: Uint8Array): { kind: UploadKind; ext: string } | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return { kind: "image", ext: "jpg" };
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "image", ext: "png" };
  if (startsWith(b, ascii("GIF87a")) || startsWith(b, ascii("GIF89a"))) return { kind: "image", ext: "gif" };
  if (startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8)) return { kind: "image", ext: "webp" };
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "audio", ext: "webm" }; // Matroska/WebM (MediaRecorder)
  if (startsWith(b, ascii("ftyp"), 4)) return { kind: "audio", ext: "mp4" };           // MP4/M4A (Safari MediaRecorder)
  if (startsWith(b, ascii("OggS"))) return { kind: "audio", ext: "ogg" };
  return null;
}

type Saved = { ok: true; url: string } | { ok: false; response: NextResponse };

/**
 * Validates `file` (present, within `maxBytes`, real content of `kind`) and
 * saves it under public/uploads/<folder>/. The name is random unless `baseName`
 * is given (e.g. one avatar per user).
 */
export async function saveUpload(file: File | null, opts: {
  kind: UploadKind;
  folder: string;
  maxBytes: number;
  baseName?: string;
}): Promise<Saved> {
  const fail = (error: string, status = 400): Saved => ({ ok: false, response: NextResponse.json({ error }, { status }) });

  if (!file || file.size === 0) return fail("No file provided");
  if (file.size > opts.maxBytes) return fail(`File too large (max ${Math.round(opts.maxBytes / 1024 / 1024)} MB)`, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffFileType(bytes);
  if (!type || type.kind !== opts.kind) {
    return fail(opts.kind === "image" ? "Only JPEG, PNG, WebP and GIF images are supported" : "Unsupported audio format");
  }

  const filename = `${opts.baseName ?? randomUUID()}.${type.ext}`;
  const dir = join(process.cwd(), "public", "uploads", opts.folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), bytes);
  return { ok: true, url: `/uploads/${opts.folder}/${filename}` };
}
