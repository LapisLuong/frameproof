/**
 * Upload validation that runs before any decoding:
 * 1. size limit, 2. magic-byte sniffing (the declared MIME type is not trusted),
 * 3. dimensions parsed from the header and checked against a pixel cap (decompression bombs).
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_PIXELS = 40_000_000;
export const MAX_SIDE = 12_000;

export type ImageKind = "png" | "jpeg" | "webp" | "gif";

export const MIME_BY_KIND: Record<ImageKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export type HeaderInfo = { kind: ImageKind; width: number; height: number };

export type ValidationResult = { ok: true; info: HeaderInfo } | { ok: false; reason: string };

export function sniffKind(b: Uint8Array): ImageKind | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return "gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "webp";
  return null;
}

const u16be = (b: Uint8Array, o: number) => (b[o]! << 8) | b[o + 1]!;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u24le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
const u32le = (b: Uint8Array, o: number) => u24le(b, o) + b[o + 3]! * 0x1000000;
const u32be = (b: Uint8Array, o: number) => ((b[o]! << 24) >>> 0) + ((b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!);

/** Read width/height from the header without decoding pixels. Returns null if the header is malformed. */
export function readDimensions(b: Uint8Array, kind: ImageKind): { width: number; height: number } | null {
  switch (kind) {
    case "png": {
      // IHDR must be the first chunk.
      if (b.length < 24 || String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!) !== "IHDR") return null;
      return { width: u32be(b, 16), height: u32be(b, 20) };
    }
    case "gif":
      return b.length >= 10 ? { width: u16le(b, 6), height: u16le(b, 8) } : null;
    case "webp": {
      if (b.length < 20) return null;
      const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
      const headerSize = chunk === "VP8L" ? 5 : 10;
      if (b.length < 20 + headerSize || u32le(b, 16) < headerSize || u32le(b, 4) + 8 < 20 + headerSize) return null;
      if (chunk === "VP8X") return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
      if (chunk === "VP8L") {
        if (b[20] !== 0x2f || b[24]! >>> 5 !== 0) return null;
        const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8 ") return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
      return null;
    }
    case "jpeg": {
      let o = 2;
      while (o + 9 < b.length) {
        if (b[o] !== 0xff) {
          o++;
          continue;
        }
        const marker = b[o + 1]!;
        if (marker === 0xff) {
          o++;
          continue;
        }
        // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: u16be(b, o + 5), width: u16be(b, o + 7) };
        }
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
          o += 2;
          continue;
        }
        o += 2 + u16be(b, o + 2);
      }
      return null;
    }
  }
}

/** Validate raw bytes. `head` should contain at least the first 64 KB (JPEG headers can sit after EXIF). */
export function validateImageBytes(head: Uint8Array, totalBytes: number): ValidationResult {
  if (totalBytes === 0) return { ok: false, reason: "The file is empty." };
  if (totalBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: `The file is ${(totalBytes / 1048576).toFixed(1)} MB. The limit is 15 MB — export a smaller version and try again.` };
  }
  const kind = sniffKind(head);
  if (!kind) return { ok: false, reason: "This file isn't a PNG, JPEG, WebP or GIF image. Other formats (SVG, HEIC, PDF) aren't supported yet." };
  const dims = readDimensions(head, kind);
  if (!dims || dims.width < 1 || dims.height < 1) {
    return { ok: false, reason: "The image header is damaged, so the file can't be read safely." };
  }
  if (dims.width > MAX_SIDE || dims.height > MAX_SIDE || dims.width * dims.height > MAX_PIXELS) {
    return { ok: false, reason: `The image is ${dims.width}×${dims.height} px. The limit is 40 megapixels and 12,000 px per side.` };
  }
  return { ok: true, info: { kind, ...dims } };
}

export async function validateImageFile(file: Blob): Promise<ValidationResult> {
  const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  return validateImageBytes(head, file.size);
}
