/**
 * Inpainting masks. The user paints on a layer at the picture's own size; anything painted (alpha > 0) becomes
 * white (reconstruct), everything else black (keep), as the inpainting contract expects. Environment-neutral.
 */

/** Convert painted RGBA pixels to an opaque black/white mask, in place in a new buffer. Returns the painted count. */
export function paintToMask(painted: Uint8ClampedArray): { mask: Uint8ClampedArray; count: number } {
  const mask = new Uint8ClampedArray(painted.length);
  let count = 0;
  for (let i = 0; i < painted.length; i += 4) {
    const on = painted[i + 3]! > 0;
    if (on) count++;
    const v = on ? 255 : 0;
    mask[i] = v;
    mask[i + 1] = v;
    mask[i + 2] = v;
    mask[i + 3] = 255;
  }
  return { mask, count };
}

/** Same limit the inpainting runtime enforces (two full RGBA buffers plus the model in one worker). */
export const INPAINT_MAX_PIXELS = 4_000_000;

/** Brush diameter in picture pixels for a diameter chosen in screen pixels, at the current display scale. */
export function brushInImage(screenPx: number, displayWidth: number, imageWidth: number): number {
  if (displayWidth <= 0) return screenPx;
  return Math.max(1, (screenPx * imageWidth) / displayWidth);
}

/** Points along a stroke segment, spaced so round dabs of this diameter join without gaps. */
export function strokePoints(a: { x: number; y: number }, b: { x: number; y: number }, diameter: number): Array<{ x: number; y: number }> {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const step = Math.max(1, diameter / 4);
  const n = Math.max(1, Math.ceil(d / step));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }));
}

export type Rect = { x: number; y: number; w: number; h: number };

/** A rectangle typed by the user, kept inside the picture with whole-pixel values and at least 1 px each way. */
export function clampRect(r: Rect, width: number, height: number): Rect {
  const num = (v: number) => (Number.isFinite(v) ? Math.round(v) : 0);
  const x = Math.min(Math.max(0, num(r.x)), width - 1);
  const y = Math.min(Math.max(0, num(r.y)), height - 1);
  return { x, y, w: Math.min(Math.max(1, num(r.w)), width - x), h: Math.min(Math.max(1, num(r.h)), height - y) };
}

/** A starting rectangle: the middle fifth of the picture. */
export function defaultRect(width: number, height: number): Rect {
  return clampRect({ x: width * 0.4, y: height * 0.4, w: width * 0.2, h: height * 0.2 }, width, height);
}
