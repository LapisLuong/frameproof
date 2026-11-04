import type { ImageAnalysis } from "../analysis/analyze";
import { EDGE_THRESHOLD } from "../analysis/structure";
import { formatRatio } from "../color/contrast";
import { bestContrastPair, THRESHOLDS } from "./engine";
import type { EvidenceType, ReviewIssue } from "./types";

type Evidence = ReviewIssue["evidence"][number];

/**
 * Structured observations about one image, for the analyzer.
 *
 * Each one restates values already in `ImageAnalysis` in words, with the numbers it rests on and its threshold.
 * Nothing here measures anything new, and nothing judges quality or guesses intent: an observation says what the
 * pixels show and what that can't tell you. The thresholds are the review engine's, so the analyzer and a review
 * describe the same image the same way.
 */
export type Observation = {
  id: "format" | "largest-colour" | "strong-colour" | "contrast" | "detail" | "quiet" | "transparency";
  title: string;
  detail: string;
  evidenceType: Exclude<EvidenceType, "ai-observed">;
  evidence: Evidence[];
  /** What the measurement can't tell you. */
  limit?: string;
};

/** A ninth of the frame holds "most of the detail" when it carries at least twice an even share (2 / 9). */
export const CONCENTRATED_DETAIL = 2 / 9;
/** Transparent pixels are mentioned once they cover at least 1% of the image. */
export const TRANSPARENCY_SHARE = 0.01;

const NINTHS = ["top left", "top centre", "top right", "middle left", "centre", "middle right", "bottom left", "bottom centre", "bottom right"];
const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export function observeImage(a: ImageAnalysis): Observation[] {
  const out: Observation[] = [];
  const swatches = a.palette.swatches;

  out.push({
    id: "format",
    title: `Format ${a.aspect.label}`,
    detail: `${a.width}×${a.height} px ${a.kind.toUpperCase()}${a.aspect.exact ? "" : `; the ratio is ${a.aspect.ratio.toFixed(3)}:1`}.`,
    evidenceType: "measured",
    evidence: [
      { label: "Size", value: `${a.width}×${a.height} px` },
      { label: "Aspect ratio", value: a.aspect.label },
    ],
  });

  const largest = swatches[0];
  if (!largest) {
    // A fully transparent image has no opaque pixels, so there is no colour to describe, neutral or otherwise.
    out.push({
      id: "largest-colour",
      title: "No opaque pixels to measure",
      detail: "Every pixel is transparent, so the image has no measured palette, strong colour or contrast pair.",
      evidenceType: "measured",
      evidence: [{ label: "Transparent", value: pct(a.palette.transparentShare, 1) }],
    });
  } else {
    out.push({
      id: "largest-colour",
      title: largest.share >= 0.5 ? "One colour covers most of the image" : "No single colour covers half the image",
      detail: `The largest colour area is ${largest.hex}, at ${pct(largest.share)} of the opaque pixels.`,
      evidenceType: "measured",
      evidence: swatches.slice(0, 3).map((s) => ({ label: s.hex, value: pct(s.share, 1) })),
      limit: "Pixel share says how much of the image a colour covers, not what role it plays.",
    });
  }

  if (largest) {
    const strong = swatches.filter((s) => s.chroma >= THRESHOLDS.accentChroma).sort((x, y) => y.chroma - x.chroma);
    const top = strong[0];
    out.push(
      top
        ? {
            id: "strong-colour",
            title: strong.length === 1 ? "One strong colour" : `${strong.length} strong colours`,
            detail: `The most saturated main colour is ${top.hex} (Oklab chroma ${top.chroma.toFixed(3)}), covering ${pct(top.share, 1)}.`,
            evidenceType: "measured",
            evidence: strong.map((s) => ({ label: s.hex, value: `chroma ${s.chroma.toFixed(3)}, ${pct(s.share, 1)}` })),
            limit: `"Strong" means Oklab chroma of at least ${THRESHOLDS.accentChroma}, the threshold the review uses for an accent.`,
          }
        : {
            id: "strong-colour",
            title: "No strong colour",
            detail: `Every main colour has Oklab chroma under ${THRESHOLDS.accentChroma}, so the palette reads as neutral or muted.`,
            evidenceType: "measured",
            evidence: swatches.slice(0, 3).map((s) => ({ label: s.hex, value: `chroma ${s.chroma.toFixed(3)}` })),
          },
    );
  }

  const pair = bestContrastPair(swatches, THRESHOLDS.minShareForPair);
  if (pair) {
    const passes = pair.ratio >= THRESHOLDS.textContrast;
    out.push({
      id: "contrast",
      title: passes ? `A main colour pair reaches ${formatRatio(pair.ratio)}` : `No main colour pair reaches ${THRESHOLDS.textContrast}:1`,
      detail: `Among colours covering at least ${pct(THRESHOLDS.minShareForPair)} of the image, the strongest pair is ${pair.a.hex} with ${pair.b.hex} at ${formatRatio(pair.ratio)}${passes ? "" : `, under the ${THRESHOLDS.textContrast}:1 WCAG AA level for body text`}.`,
      evidenceType: "measured",
      evidence: [{ label: `${pair.a.hex} / ${pair.b.hex}`, value: formatRatio(pair.ratio) }],
      limit: "Pixel counts can't tell which colours sit behind text. Check real text and background pairs with the contrast picker.",
    });
  }

  const grid = a.structure.detailGrid;
  // With no edges at all, the detail centre and 3×3 shares are structure.ts's neutral defaults (0.5, 0.5 and 1/9),
  // not a measured position, so nothing is said about where detail sits.
  if (a.structure.edgeDensity === 0) {
    out.push({
      id: "detail",
      title: "No edges to locate",
      detail: `No pixel passes the edge threshold (Sobel magnitude ${EDGE_THRESHOLD} on 0–1 lightness), so there is no detail to place in the frame.`,
      evidenceType: "measured",
      evidence: [{ label: "Edge density", value: pct(0, 1) }],
      limit: "Very soft gradients stay under the threshold and aren't counted as detail.",
    });
  } else {
    const peak = grid.reduce((best, v, i) => (v > (grid[best] ?? -1) ? i : best), 0);
    const peakShare = grid[peak] ?? 0;
    const c = a.structure.detailCentroid;
    out.push({
      id: "detail",
      title: peakShare >= CONCENTRATED_DETAIL ? `Detail gathers in the ${NINTHS[peak]}` : "Detail is spread across the frame",
      detail: `The ${NINTHS[peak]} ninth carries ${pct(peakShare)} of the edge strength (an even spread is 11%). The detail-weighted centre sits ${pct(c.x)} across and ${pct(c.y)} down.`,
      evidenceType: "measured",
      evidence: [
        { label: "Densest ninth", value: `${NINTHS[peak]}, ${pct(peakShare)}` },
        { label: "Detail centre", value: `${pct(c.x)}, ${pct(c.y)}` },
        { label: "Edge density", value: pct(a.structure.edgeDensity, 1) },
      ],
      limit: "Edges come from type, texture and photographs alike; this shows where detail is, not what it is or whether it reads first.",
    });
  }

  out.push({
    id: "quiet",
    title: `About ${pct(a.structure.quietShare)} of the image is flat`,
    detail: `${pct(a.structure.quietShare)} of a 16×16 grid has almost no edges or tonal variation.`,
    evidenceType: "estimated",
    evidence: [{ label: "Quiet area", value: pct(a.structure.quietShare) }],
    limit: "Any flat area counts, whether it is intended open space or an empty patch.",
  });

  if (a.palette.transparentShare >= TRANSPARENCY_SHARE) {
    out.push({
      id: "transparency",
      title: "Part of the image is transparent",
      detail: `${pct(a.palette.transparentShare, 1)} of pixels are transparent and were left out of the palette.`,
      evidenceType: "measured",
      evidence: [{ label: "Transparent", value: pct(a.palette.transparentShare, 1) }],
    });
  }

  return out;
}

export function observationsToMarkdown(obs: Observation[]): string[] {
  return obs.flatMap((o) => [
    `### ${o.title}`,
    "",
    `${o.detail} _(${o.evidenceType})_`,
    "",
    ...o.evidence.map((e) => `- ${e.label}: ${e.value}`),
    ...(o.limit ? ["", `What this can't tell you: ${o.limit}`] : []),
    "",
  ]);
}
