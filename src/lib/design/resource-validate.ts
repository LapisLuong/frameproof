import { sniffKind } from "../image/validate";
import { MAX_FONT_BYTES, type ResourceMeta } from "./resource";

export function sniffFont(bytes: Uint8Array): "font/ttf" | "font/otf" | "font/woff" | "font/woff2" | null {
  if (bytes.length < 4) return null;
  const signature = String.fromCharCode(...bytes.subarray(0, 4));
  if (signature === "\0\x01\0\0" || signature === "true") return "font/ttf";
  return ({ OTTO: "font/otf", wOFF: "font/woff", wOF2: "font/woff2" } as const)[signature as "OTTO"] ?? null;
}
export function validateFontFile(bytes: Uint8Array): { ok: true; mime: NonNullable<ReturnType<typeof sniffFont>> } | { ok: false; reason: string } {
  if (!bytes.length) return { ok: false, reason: "The file is empty." };
  if (bytes.length > MAX_FONT_BYTES) return { ok: false, reason: "The font exceeds the 10 MB limit." };
  const mime = sniffFont(bytes);
  return mime ? { ok: true, mime } : { ok: false, reason: "This file is not a supported TTF, OTF, WOFF or WOFF2 font." };
}
export function sniffResource(bytes: Uint8Array): ResourceMeta["mime"] | null {
  const font = sniffFont(bytes);
  if (font) return font;
  const kind = sniffKind(bytes);
  return kind ? ({ png: "image/png", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" } as const)[kind] : null;
}
