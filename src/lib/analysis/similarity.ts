import { colorHistogram } from "./palette";
import { fitContain, lumaPlane, resample, type PixelBuffer } from "./pixels";

/** Common comparison canvas: long side 256 px, at the reference's aspect ratio (capped 1:2..2:1). */
export function comparisonSize(ref: { width: number; height: number }): { w: number; h: number } {
  const aspect = Math.min(2, Math.max(0.5, ref.width / ref.height));
  return aspect >= 1 ? { w: 256, h: Math.round(256 / aspect) } : { w: Math.round(256 * aspect), h: 256 };
}

/**
 * Mean SSIM over 8×8 windows (stride 4) on luma, constants from Wang et al. 2004 (K1=.01, K2=.03, L=1).
 * Translation-sensitive: a 2% layout shift can drop SSIM sharply even when the design "looks the same".
 */
export function ssim(a: Float32Array, b: Float32Array, w: number, h: number): number {
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;
  const win = 8;
  const step = 4;
  let total = 0;
  let count = 0;
  for (let y = 0; y + win <= h; y += step) {
    for (let x = 0; x + win <= w; x += step) {
      let ma = 0,
        mb = 0;
      for (let j = 0; j < win; j++)
        for (let i = 0; i < win; i++) {
          const p = (y + j) * w + x + i;
          ma += a[p]!;
          mb += b[p]!;
        }
      const N = win * win;
      ma /= N;
      mb /= N;
      let va = 0,
        vb = 0,
        cov = 0;
      for (let j = 0; j < win; j++)
        for (let i = 0; i < win; i++) {
          const p = (y + j) * w + x + i;
          const da = a[p]! - ma;
          const db = b[p]! - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      va /= N - 1;
      vb /= N - 1;
      cov /= N - 1;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return count ? total / count : 1;
}

/** 64-bit difference hash (9×8 luma gradient). Tolerates small shifts and rescales; ignores colour. */
export function dHash(buf: PixelBuffer): bigint {
  const small = resample(buf, 9, 8);
  const l = lumaPlane(small);
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      hash = (hash << 1n) | (l[y * 9 + x]! > l[y * 9 + x + 1]! ? 1n : 0n);
    }
  }
  return hash;
}

export function hamming64(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/** Histogram intersection on the 64-bin RGB histogram, 0..1. Ignores where colours are placed. */
export function histogramIntersection(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.min(a[i]!, b[i]!);
  return s;
}

export type DiffMap = { width: number; height: number; values: Float32Array };

export type Comparison = {
  canvas: { width: number; height: number; note: string };
  ssim: number;
  dHashDistance: number;
  histogramIntersection: number;
  /** Share of pixels whose luma differs by more than 0.1 on the common canvas. */
  changedShare: number;
  aspectDifference: number;
  diff: DiffMap;
};

export function compareImages(
  ref: PixelBuffer,
  cur: PixelBuffer,
  refOriginal: { width: number; height: number },
  curOriginal: { width: number; height: number },
): Comparison {
  const { w, h } = comparisonSize(refOriginal);
  const A = fitContain(ref, w, h);
  const B = fitContain(cur, w, h);
  const la = lumaPlane(A);
  const lb = lumaPlane(B);
  const diff = new Float32Array(w * h);
  let changed = 0;
  for (let i = 0; i < diff.length; i++) {
    const d = Math.abs(la[i]! - lb[i]!);
    diff[i] = d;
    if (d > 0.1) changed++;
  }
  const ra = refOriginal.width / refOriginal.height;
  const rb = curOriginal.width / curOriginal.height;
  return {
    canvas: {
      width: w,
      height: h,
      note: `Both images fitted (no stretching) into ${w}×${h} px on mid-grey before comparing.`,
    },
    ssim: ssim(la, lb, w, h),
    dHashDistance: hamming64(dHash(ref), dHash(cur)),
    histogramIntersection: histogramIntersection(colorHistogram(ref), colorHistogram(cur)),
    changedShare: changed / diff.length,
    aspectDifference: Math.abs(ra - rb) / ra,
    diff: { width: w, height: h, values: diff },
  };
}
