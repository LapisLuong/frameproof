import { colorFrequency, extractPalette, type FrequencyBin } from "./palette";
import { downscale, type PixelBuffer } from "./pixels";
import { compareImages, type Comparison } from "./similarity";
import { measureStructure, type StructureMetrics } from "./structure";

/** Long side of the working copy used for palette and structure measures. */
export const ANALYSIS_SIDE = 256;

export type StoredSwatch = { hex: string; share: number; chroma: number; L: number };

export type ImageAnalysis = {
  width: number;
  height: number;
  bytes: number;
  kind: string;
  aspect: { ratio: number; label: string; exact: boolean };
  analysisSize: { width: number; height: number };
  palette: { swatches: StoredSwatch[]; transparentShare: number; method: string };
  frequency: FrequencyBin[];
  structure: StructureMetrics;
};

export type StoredComparison = Omit<Comparison, "diff">;

const COMMON_RATIOS: Array<[string, number]> = [
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["3:4", 3 / 4],
  ["4:3", 4 / 3],
  ["2:3", 2 / 3],
  ["3:2", 3 / 2],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
  ["ISO A portrait (1:√2)", 1 / Math.SQRT2],
  ["ISO A landscape (√2:1)", Math.SQRT2],
  ["21:9", 21 / 9],
];

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

export function describeAspect(width: number, height: number): ImageAnalysis["aspect"] {
  const ratio = width / height;
  const g = gcd(width, height);
  const w = width / g;
  const h = height / g;
  if (w <= 32 && h <= 32) return { ratio, label: `${w}:${h}`, exact: true };
  let best: [string, number] = COMMON_RATIOS[0]!;
  for (const r of COMMON_RATIOS) if (Math.abs(r[1] - ratio) < Math.abs(best[1] - ratio)) best = r;
  if (Math.abs(best[1] - ratio) / best[1] < 0.01) return { ratio, label: `≈ ${best[0]}`, exact: false };
  return { ratio, label: `${ratio.toFixed(3)}:1`, exact: false };
}

/** Full single-image analysis from a decoded pixel buffer (any size; it is downscaled here). */
export function analyzeBuffer(full: PixelBuffer, meta: { width: number; height: number; bytes: number; kind: string }, k = 6): ImageAnalysis {
  const work = downscale(full, ANALYSIS_SIDE);
  const palette = extractPalette(work, k);
  return {
    width: meta.width,
    height: meta.height,
    bytes: meta.bytes,
    kind: meta.kind,
    aspect: describeAspect(meta.width, meta.height),
    analysisSize: { width: work.width, height: work.height },
    palette: {
      swatches: palette.swatches.map((s) => ({ hex: s.hex, share: s.share, chroma: s.chroma, L: s.oklab.L })),
      transparentShare: palette.transparentShare,
      method: palette.method,
    },
    frequency: colorFrequency(work),
    structure: measureStructure(work),
  };
}

export function compareBuffers(
  ref: PixelBuffer,
  cur: PixelBuffer,
  refMeta: { width: number; height: number },
  curMeta: { width: number; height: number },
): Comparison {
  // Compare at a common working size; full-size pixels are never needed for these measures.
  return compareImages(downscale(ref, 512), downscale(cur, 512), refMeta, curMeta);
}

export function stripDiff(c: Comparison): StoredComparison {
  const { diff: _diff, ...rest } = c;
  void _diff;
  return rest;
}
