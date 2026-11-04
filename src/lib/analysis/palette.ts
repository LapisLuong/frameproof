import { chroma, deltaEOK, oklabToRgb, rgbToHex, rgbToOklab, type Oklab, type RGB } from "../color/convert";
import { mulberry32, type PixelBuffer } from "./pixels";

export type Swatch = {
  hex: string;
  rgb: RGB;
  oklab: Oklab;
  /** Share of opaque analysed pixels assigned to this cluster, 0..1. */
  share: number;
  /** Oklab chroma, useful for telling neutrals from accents. */
  chroma: number;
};

export type PaletteResult = {
  swatches: Swatch[];
  /** Fraction of pixels with alpha < 128, excluded from clustering. */
  transparentShare: number;
  method: string;
};

const ALPHA_CUTOFF = 128;

/**
 * Dominant colours by k-means in Oklab with k-means++ seeding and a fixed seed.
 * Clusters closer than ΔE_OK 0.03 are merged afterwards so near-duplicates don't crowd the list.
 *
 * What this is: a frequency-weighted summary of the pixels.
 * What it is not: the brand palette or the designer's token set. Small but important colours
 * (a call-to-action button) can be missed because they cover little area.
 */
export function extractPalette(buf: PixelBuffer, k = 6, seed = 7): PaletteResult {
  const pts: Oklab[] = [];
  let transparent = 0;
  const total = buf.width * buf.height;
  for (let i = 0; i < buf.data.length; i += 4) {
    if (buf.data[i + 3]! < ALPHA_CUTOFF) {
      transparent++;
      continue;
    }
    pts.push(rgbToOklab({ r: buf.data[i]!, g: buf.data[i + 1]!, b: buf.data[i + 2]! }));
  }
  const method = `k-means (k=${k}) in Oklab, k-means++ seed ${seed}, ${pts.length.toLocaleString("en-US")} pixels at ${buf.width}×${buf.height}`;
  if (pts.length === 0) return { swatches: [], transparentShare: total ? transparent / total : 0, method };

  const rand = mulberry32(seed);
  const kk = Math.min(k, pts.length);
  const centers: Oklab[] = [pts[Math.floor(rand() * pts.length)]!];
  const dist = new Float64Array(pts.length).fill(Infinity);

  // k-means++ seeding
  while (centers.length < kk) {
    const last = centers[centers.length - 1]!;
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      const d = deltaEOK(pts[i]!, last) ** 2;
      if (d < dist[i]!) dist[i] = d;
      sum += dist[i]!;
    }
    if (sum === 0) break; // fewer distinct colours than k
    let target = rand() * sum;
    let idx = 0;
    for (; idx < pts.length - 1; idx++) {
      target -= dist[idx]!;
      if (target <= 0) break;
    }
    centers.push(pts[idx]!);
  }

  const assign = new Int32Array(pts.length);
  for (let iter = 0; iter < 24; iter++) {
    const sums = centers.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const p = pts[i]!;
        const q = centers[c]!;
        const d = (p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
      const s = sums[best]!;
      s.L += pts[i]!.L;
      s.a += pts[i]!.a;
      s.b += pts[i]!.b;
      s.n++;
    }
    let moved = 0;
    for (let c = 0; c < centers.length; c++) {
      const s = sums[c]!;
      if (s.n === 0) continue;
      const next = { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n };
      moved = Math.max(moved, deltaEOK(next, centers[c]!));
      centers[c] = next;
    }
    if (moved < 1e-4) break;
  }

  const counts = new Array<number>(centers.length).fill(0);
  for (let i = 0; i < pts.length; i++) counts[assign[i]!]!++;

  // Merge near-duplicates (weighted mean).
  type Cl = { c: Oklab; n: number };
  let clusters: Cl[] = centers.map((c, i) => ({ c, n: counts[i]! })).filter((x) => x.n > 0);
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (deltaEOK(clusters[i]!.c, clusters[j]!.c) < 0.03) {
          const A = clusters[i]!;
          const B = clusters[j]!;
          const n = A.n + B.n;
          clusters[i] = {
            n,
            c: { L: (A.c.L * A.n + B.c.L * B.n) / n, a: (A.c.a * A.n + B.c.a * B.n) / n, b: (A.c.b * A.n + B.c.b * B.n) / n },
          };
          clusters = clusters.filter((_, idx) => idx !== j);
          merged = true;
          break outer;
        }
      }
    }
  }

  const swatches = clusters
    .map(({ c, n }) => {
      const rgb = oklabToRgb(c);
      return { hex: rgbToHex(rgb), rgb, oklab: c, share: n / pts.length, chroma: chroma(c) };
    })
    .sort((x, y) => y.share - x.share);

  return { swatches, transparentShare: total ? transparent / total : 0, method };
}

export type FrequencyBin = { hex: string; share: number };

/**
 * Colour frequency in a coarse 4×4×4 RGB grid (64 bins). Bin colour is the mean of its pixels.
 * Smooth gradients spread across bins, which lowers the share of what reads as one colour.
 */
export function colorFrequency(buf: PixelBuffer, top = 12): FrequencyBin[] {
  const n = new Float64Array(64);
  const sr = new Float64Array(64);
  const sg = new Float64Array(64);
  const sb = new Float64Array(64);
  let total = 0;
  for (let i = 0; i < buf.data.length; i += 4) {
    if (buf.data[i + 3]! < ALPHA_CUTOFF) continue;
    const r = buf.data[i]!;
    const g = buf.data[i + 1]!;
    const b = buf.data[i + 2]!;
    const bin = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
    n[bin]!++;
    sr[bin]! += r;
    sg[bin]! += g;
    sb[bin]! += b;
    total++;
  }
  const bins: FrequencyBin[] = [];
  for (let i = 0; i < 64; i++) {
    if (!n[i]) continue;
    bins.push({ hex: rgbToHex({ r: sr[i]! / n[i]!, g: sg[i]! / n[i]!, b: sb[i]! / n[i]! }), share: n[i]! / total });
  }
  return bins.sort((a, b) => b.share - a.share).slice(0, top);
}

/** Normalised 64-bin histogram, for distribution comparisons. */
export function colorHistogram(buf: PixelBuffer): Float64Array {
  const h = new Float64Array(64);
  let total = 0;
  for (let i = 0; i < buf.data.length; i += 4) {
    if (buf.data[i + 3]! < ALPHA_CUTOFF) continue;
    h[((buf.data[i]! >> 6) << 4) | ((buf.data[i + 1]! >> 6) << 2) | (buf.data[i + 2]! >> 6)]!++;
    total++;
  }
  if (total) for (let i = 0; i < 64; i++) h[i]! /= total;
  return h;
}
