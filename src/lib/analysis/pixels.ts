/**
 * Environment-neutral pixel buffer. Browser code fills it from a canvas; tests build it by hand.
 * `data` is RGBA, row-major, 8 bits per channel — the same layout as ImageData.
 */
export type PixelBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export function createBuffer(width: number, height: number, fill?: [number, number, number, number]): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fill[0];
      data[i + 1] = fill[1];
      data[i + 2] = fill[2];
      data[i + 3] = fill[3];
    }
  }
  return { width, height, data };
}

/** Paint an axis-aligned rectangle (used by tests and sample generation). */
export function fillRect(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  w: number,
  h: number,
  rgba: [number, number, number, number],
): void {
  for (let y = Math.max(0, y0); y < Math.min(buf.height, y0 + h); y++) {
    for (let x = Math.max(0, x0); x < Math.min(buf.width, x0 + w); x++) {
      const i = (y * buf.width + x) * 4;
      buf.data[i] = rgba[0];
      buf.data[i + 1] = rgba[1];
      buf.data[i + 2] = rgba[2];
      buf.data[i + 3] = rgba[3];
    }
  }
}

/** Rec. 709 luma of the gamma-encoded values, 0..1. Fast and adequate for structure measures. */
export function lumaPlane(buf: PixelBuffer): Float32Array {
  const out = new Float32Array(buf.width * buf.height);
  const d = buf.data;
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const a = d[i + 3]! / 255;
    // Composite transparent pixels over white so "empty" reads as paper, not black.
    const r = d[i]! * a + 255 * (1 - a);
    const g = d[i + 1]! * a + 255 * (1 - a);
    const b = d[i + 2]! * a + 255 * (1 - a);
    out[p] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return out;
}

/** Deterministic PRNG (mulberry32) so k-means results are reproducible run to run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-filter downscale to fit inside maxSide (never upscales). Alpha-weighted. */
export function downscale(buf: PixelBuffer, maxSide: number): PixelBuffer {
  const scale = Math.min(1, maxSide / Math.max(buf.width, buf.height));
  if (scale === 1) return buf;
  const w = Math.max(1, Math.round(buf.width * scale));
  const h = Math.max(1, Math.round(buf.height * scale));
  return resample(buf, w, h);
}

/** Area-averaging resample to an exact size (may change aspect — callers decide). */
export function resample(buf: PixelBuffer, w: number, h: number): PixelBuffer {
  const out = createBuffer(w, h);
  const sx = buf.width / w;
  const sy = buf.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < Math.min(y1, buf.height); yy++) {
        for (let xx = x0; xx < Math.min(x1, buf.width); xx++) {
          const i = (yy * buf.width + xx) * 4;
          const al = buf.data[i + 3]!;
          r += buf.data[i]! * al;
          g += buf.data[i + 1]! * al;
          b += buf.data[i + 2]! * al;
          a += al;
          n++;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
      }
      out.data[o + 3] = n ? a / n : 0;
    }
  }
  return out;
}

/**
 * Fit an image inside a w×h box without distortion, centred on a neutral grey (#808080).
 * Used whenever two images of different size must be compared pixel to pixel.
 */
export function fitContain(buf: PixelBuffer, w: number, h: number): PixelBuffer {
  const scale = Math.min(w / buf.width, h / buf.height);
  const iw = Math.max(1, Math.round(buf.width * scale));
  const ih = Math.max(1, Math.round(buf.height * scale));
  const inner = resample(buf, iw, ih);
  const out = createBuffer(w, h, [128, 128, 128, 255]);
  const ox = Math.floor((w - iw) / 2);
  const oy = Math.floor((h - ih) / 2);
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const i = (y * iw + x) * 4;
      const o = ((y + oy) * w + (x + ox)) * 4;
      const a = inner.data[i + 3]! / 255;
      out.data[o] = inner.data[i]! * a + 128 * (1 - a);
      out.data[o + 1] = inner.data[i + 1]! * a + 128 * (1 - a);
      out.data[o + 2] = inner.data[i + 2]! * a + 128 * (1 - a);
      out.data[o + 3] = 255;
    }
  }
  return out;
}
