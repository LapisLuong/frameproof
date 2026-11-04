import { lumaPlane, type PixelBuffer } from "./pixels";

/** Sobel magnitude threshold (on 0..1 luma) above which a pixel counts as an edge. */
export const EDGE_THRESHOLD = 0.25;

export type StructureMetrics = {
  /** Mean luma 0..1. */
  meanLuma: number;
  /** Standard deviation of luma — a global tonal-contrast measure (RMS contrast). */
  lumaStdDev: number;
  /** Share of pixels whose Sobel magnitude exceeds EDGE_THRESHOLD. Measured. */
  edgeDensity: number;
  /** Edge-magnitude-weighted centre of detail, as fractions of width/height. Measured. */
  detailCentroid: { x: number; y: number };
  /**
   * Share of a 16×16 grid whose cells are flat (low edges and low tonal variation).
   * Estimated: treats any flat area as "quiet", whether intended negative space or not.
   */
  quietShare: number;
  /** Mean edge magnitude per cell of a 3×3 grid, row-major, normalised to sum 1. Measured. */
  detailGrid: number[];
  /** 16-bin luma histogram, normalised. */
  lumaHistogram: number[];
};

export function sobel(luma: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  const at = (x: number, y: number) => luma[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      mag[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

export function measureStructure(buf: PixelBuffer): StructureMetrics {
  const { width: w, height: h } = buf;
  const luma = lumaPlane(buf);
  const mag = sobel(luma, w, h);
  const n = w * h;

  let sum = 0;
  for (let i = 0; i < n; i++) sum += luma[i]!;
  const meanLuma = sum / n;
  let varSum = 0;
  const hist = new Array<number>(16).fill(0);
  for (let i = 0; i < n; i++) {
    varSum += (luma[i]! - meanLuma) ** 2;
    hist[Math.min(15, Math.floor(luma[i]! * 16))]!++;
  }

  let edges = 0;
  let mx = 0;
  let my = 0;
  let mt = 0;
  const grid3 = new Array<number>(9).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = mag[y * w + x]!;
      if (m > EDGE_THRESHOLD) edges++;
      mx += m * (x + 0.5);
      my += m * (y + 0.5);
      mt += m;
      grid3[Math.min(2, Math.floor((y / h) * 3)) * 3 + Math.min(2, Math.floor((x / w) * 3))]! += m;
    }
  }

  // Quiet cells: 16×16 grid (or fewer on tiny images).
  const gx = Math.min(16, w);
  const gy = Math.min(16, h);
  let quiet = 0;
  for (let cy = 0; cy < gy; cy++) {
    for (let cx = 0; cx < gx; cx++) {
      const x0 = Math.floor((cx * w) / gx);
      const x1 = Math.floor(((cx + 1) * w) / gx);
      const y0 = Math.floor((cy * h) / gy);
      const y1 = Math.floor(((cy + 1) * h) / gy);
      let s = 0, s2 = 0, e = 0, c = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = luma[y * w + x]!;
          s += v;
          s2 += v * v;
          e += mag[y * w + x]!;
          c++;
        }
      }
      if (!c) continue;
      const mean = s / c;
      const sd = Math.sqrt(Math.max(0, s2 / c - mean * mean));
      if (e / c < 0.05 && sd < 0.04) quiet++;
    }
  }

  return {
    meanLuma,
    lumaStdDev: Math.sqrt(varSum / n),
    edgeDensity: edges / n,
    detailCentroid: mt > 0 ? { x: mx / mt / w, y: my / mt / h } : { x: 0.5, y: 0.5 },
    quietShare: quiet / (gx * gy),
    detailGrid: mt > 0 ? grid3.map((v) => v / mt) : grid3.map(() => 1 / 9),
    lumaHistogram: hist.map((v) => v / n),
  };
}
