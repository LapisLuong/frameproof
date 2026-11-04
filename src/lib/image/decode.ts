"use client";

import { analyzeBuffer, type ImageAnalysis } from "../analysis/analyze";
import type { PixelBuffer } from "../analysis/pixels";
import { MIME_BY_KIND, validateImageFile, type HeaderInfo } from "./validate";

/** Long side of the pixel copy kept in memory for comparisons. */
export const WORK_SIDE = 512;
const THUMB_SIDE = 640;

export type DecodedImage = {
  info: HeaderInfo;
  mime: string;
  pixels: PixelBuffer;
  thumb: Blob;
  analysis: ImageAnalysis;
};

export class ImageRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageRejectedError";
  }
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Draw a bitmap scaled to fit `side`, return its pixels. High-quality browser resampling. */
function rasterize(bitmap: ImageBitmap, side: number): PixelBuffer {
  const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const c = canvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D isn't available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  return { width: w, height: h, data: img.data };
}

async function thumbnail(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, THUMB_SIDE / Math.max(bitmap.width, bitmap.height));
  const c = canvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D isn't available in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create a thumbnail."))), "image/webp", 0.86));
}

/** Validate, decode, measure. Throws ImageRejectedError with a user-facing reason. */
export async function decodeAndAnalyze(file: Blob, k = 6): Promise<DecodedImage> {
  const v = await validateImageFile(file);
  if (!v.ok) throw new ImageRejectedError(v.reason);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageRejectedError("The browser couldn't decode this image. It may be damaged or use an unsupported variant.");
  }
  try {
    if (bitmap.width !== v.info.width || bitmap.height !== v.info.height) {
      // EXIF rotation can swap sides; anything else means the header lied.
      const swapped = bitmap.width === v.info.height && bitmap.height === v.info.width;
      if (!swapped) throw new ImageRejectedError("The decoded size doesn't match the file header, so the file was rejected.");
    }
    const pixels = rasterize(bitmap, WORK_SIDE);
    const analysis = analyzeBuffer(pixels, { width: bitmap.width, height: bitmap.height, bytes: file.size, kind: v.info.kind }, k);
    return {
      info: { ...v.info, width: bitmap.width, height: bitmap.height },
      mime: MIME_BY_KIND[v.info.kind],
      pixels,
      thumb: await thumbnail(bitmap),
      analysis,
    };
  } finally {
    bitmap.close();
  }
}

/** Re-read pixels for a stored image (used for comparison and the difference view). */
export async function pixelsFromBlob(blob: Blob, side = WORK_SIDE): Promise<PixelBuffer> {
  const bitmap = await createImageBitmap(blob);
  try {
    return rasterize(bitmap, side);
  } finally {
    bitmap.close();
  }
}
