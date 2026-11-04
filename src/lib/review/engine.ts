import type { ImageAnalysis, StoredComparison, StoredSwatch } from "../analysis/analyze";
import { contrastRatio, formatRatio } from "../color/contrast";
import { deltaEOK, hexToRgb, rgbToOklab } from "../color/convert";
import { sortIssues, type ReviewIssue } from "./types";

/**
 * Deterministic review rules. Each rule reads only measured values and states its threshold.
 * Rules never claim to know fonts, intent, or semantic hierarchy — those belong to the user or AI.
 */

export const THRESHOLDS = {
  aspect: 0.02,
  paletteDrift: 0.08,
  missingColor: 0.1,
  newColor: 0.12,
  /** Oklab chroma above which a colour counts as "strong" (muted teals sit near 0.08). */
  newColorChroma: 0.07,
  accentChroma: 0.08,
  edgeRatio: 1.5,
  edgeAbs: 0.03,
  quietDiff: 0.15,
  centroidShift: 0.12,
  tonalRatio: 0.65,
  textContrast: 4.5,
  minShareForPair: 0.05,
} as const;

const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const lab = (s: StoredSwatch) => rgbToOklab(hexToRgb(s.hex)!);

function nearest(target: StoredSwatch, pool: StoredSwatch[]): { swatch: StoredSwatch | null; d: number } {
  let best: StoredSwatch | null = null;
  let d = Infinity;
  const t = lab(target);
  for (const s of pool) {
    const dd = deltaEOK(t, lab(s));
    if (dd < d) {
      d = dd;
      best = s;
    }
  }
  return { swatch: best, d };
}

/** Share-weighted mean distance from each reference colour to its closest current colour. */
export function paletteDrift(ref: StoredSwatch[], cur: StoredSwatch[]): number {
  if (!ref.length || !cur.length) return 0;
  let s = 0;
  let w = 0;
  for (const r of ref) {
    s += nearest(r, cur).d * r.share;
    w += r.share;
  }
  return w ? s / w : 0;
}

export function bestContrastPair(swatches: StoredSwatch[], minShare: number): { a: StoredSwatch; b: StoredSwatch; ratio: number } | null {
  const pool = swatches.filter((s) => s.share >= minShare);
  let best: { a: StoredSwatch; b: StoredSwatch; ratio: number } | null = null;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const ratio = contrastRatio(hexToRgb(pool[i]!.hex)!, hexToRgb(pool[j]!.hex)!);
      if (!best || ratio > best.ratio) best = { a: pool[i]!, b: pool[j]!, ratio };
    }
  }
  return best;
}

function direction(dx: number, dy: number): string {
  const parts: string[] = [];
  if (Math.abs(dy) > 0.05) parts.push(dy < 0 ? "up" : "down");
  if (Math.abs(dx) > 0.05) parts.push(dx < 0 ? "left" : "right");
  return parts.join(" and ") || "slightly";
}

export type RuleContext = { reference: ImageAnalysis; current: ImageAnalysis; comparison: StoredComparison };

type Draft = Omit<ReviewIssue, "id" | "resolved" | "source"> & { rule: string };

export function runRules({ reference: R, current: C, comparison: X }: RuleContext): Draft[] {
  const out: Draft[] = [];

  // 1. Format
  if (X.aspectDifference > THRESHOLDS.aspect) {
    out.push({
      rule: "aspect",
      category: "layout",
      title: "Format differs from the reference",
      observation: `The current design is ${C.width}×${C.height} px (${C.aspect.label}); the reference is ${R.width}×${R.height} px (${R.aspect.label}). The aspect ratios differ by ${pct(X.aspectDifference, 1)}.`,
      recommendation:
        "Confirm the output format first. If both pieces target the same format, match the reference's aspect ratio before adjusting composition.",
      rationale:
        "Composition decisions — margins, scale, where the eye lands — only transfer between pieces of the same proportion. Comparisons below are less reliable while formats differ.",
      preserve: "Keep the current arrangement of elements until the format is settled.",
      priority: X.aspectDifference > 0.1 ? "high" : "medium",
      confidence: "high",
      evidenceType: "measured",
      evidence: [
        { label: "Reference", value: `${R.width}×${R.height}` },
        { label: "Current", value: `${C.width}×${C.height}` },
        { label: "Aspect difference", value: pct(X.aspectDifference, 1) },
      ],
    });
  }

  // 2. Palette drift and missing colours
  const drift = paletteDrift(R.palette.swatches, C.palette.swatches);
  if (drift > THRESHOLDS.paletteDrift) {
    const missing = R.palette.swatches
      .filter((s) => s.share >= 0.05)
      .map((s) => ({ s, n: nearest(s, C.palette.swatches) }))
      .filter((x) => x.n.d > THRESHOLDS.missingColor);
    out.push({
      rule: "palette-drift",
      category: "color",
      title: "Palette has drifted from the reference",
      observation:
        `On average, each reference colour is ΔE_OK ${drift.toFixed(3)} from its closest match in the current design (0.02 is barely visible).` +
        (missing.length
          ? ` Reference colours without a close match: ${missing.map((m) => `${m.s.hex} (${pct(m.s.share)} of the reference)`).join(", ")}.`
          : ""),
      recommendation: missing.length
        ? `Bring ${missing.map((m) => m.s.hex).join(", ")} back for the areas that carried them in the reference, or decide deliberately that the new palette replaces them.`
        : "Re-sample the reference colours and adjust the current hues and values toward them.",
      rationale: "Colour carries most of a reference's mood at a glance. A drift this size reads as a different art direction rather than a variation.",
      preserve: "Keep colours that already match (ΔE_OK under 0.03) unchanged so the comparison stays anchored.",
      priority: drift > 0.15 ? "high" : "medium",
      confidence: "high",
      evidenceType: "measured",
      evidence: [
        { label: "Mean ΔE_OK", value: drift.toFixed(3) },
        ...missing.slice(0, 3).map((m) => ({ label: `Missing ${m.s.hex}`, value: `closest ${m.n.swatch?.hex ?? "—"}, ΔE ${m.n.d.toFixed(3)}` })),
      ],
    });
  }

  // 3. Accent coverage
  const refAccent = [...R.palette.swatches].filter((s) => s.chroma >= THRESHOLDS.accentChroma && s.share >= 0.02).sort((a, b) => b.chroma - a.chroma)[0];
  if (refAccent) {
    const match = nearest(refAccent, C.palette.swatches);
    const curShare = match.d <= THRESHOLDS.missingColor && match.swatch ? match.swatch.share : 0;
    const ratio = curShare / refAccent.share;
    if ((ratio < 0.4 || ratio > 2.5) && Math.abs(curShare - refAccent.share) > 0.03) {
      const less = ratio < 1;
      out.push({
        rule: "accent-coverage",
        category: "color",
        title: less ? "Accent colour covers much less area" : "Accent colour covers much more area",
        observation: `The reference's strongest accent, ${refAccent.hex}, covers ${pct(refAccent.share)} of it. ${curShare ? `Its closest match covers ${pct(curShare)} of the current design.` : "The current design has no close match for it."}`,
        recommendation: less
          ? "Give the accent back a clear, deliberate role — one large shape or the headline block — rather than scattering small touches."
          : "Pull the accent back to the one or two places that need attention; let neutrals carry the rest.",
        rationale: "An accent works by scarcity and placement. Changing its coverage this much changes where the eye goes first.",
        preserve: "Keep the accent's exact hue; only its coverage needs to move.",
        priority: "medium",
        confidence: "medium",
        evidenceType: "measured",
        evidence: [
          { label: "Reference accent", value: `${refAccent.hex} · ${pct(refAccent.share)}` },
          { label: "Current coverage", value: pct(curShare) },
        ],
      });
    }
  }

  // 4. New dominant colour
  for (const s of C.palette.swatches) {
    if (s.chroma < THRESHOLDS.newColorChroma || s.share < 0.05) continue;
    const n = nearest(s, R.palette.swatches);
    // New if it is far from every reference colour, or if its nearest match is a neutral
    // (a saturated hue "matching" a grey of similar lightness is still a new hue).
    const nearestIsNeutral = (n.swatch?.chroma ?? 0) < 0.04;
    if (n.d > THRESHOLDS.newColor || (nearestIsNeutral && n.d > 0.06)) {
      out.push({
        rule: `new-color-${s.hex}`,
        category: "consistency",
        title: "A new strong colour isn't in the reference",
        observation: `${s.hex} covers ${pct(s.share)} of the current design. The closest reference colour is ${n.swatch?.hex ?? "—"} (ΔE_OK ${n.d.toFixed(3)}).`,
        recommendation: `Decide whether ${s.hex} is intended. If not, move it toward ${n.swatch?.hex ?? "a reference colour"}; if it is, add it to the style so it's used consistently.`,
        rationale: "An unplanned saturated colour at this size competes with the reference's accent for attention.",
        preserve: "Keep its role in the layout if it marks something important — only the hue is in question.",
        priority: s.share > 0.15 ? "medium" : "low",
        confidence: "medium",
        evidenceType: "measured",
        evidence: [{ label: s.hex, value: `${pct(s.share)} · chroma ${s.chroma.toFixed(3)}` }],
      });
      break; // one is enough; the rest show in the palette
    }
  }

  // 5. No dominant colour pair reaches text contrast
  const pair = bestContrastPair(C.palette.swatches, THRESHOLDS.minShareForPair);
  if (pair && pair.ratio < THRESHOLDS.textContrast) {
    out.push({
      rule: "palette-contrast",
      category: "accessibility",
      title: "Check text contrast",
      observation: `No two of the main colours (each covering at least 5% of the design) reach 4.5:1. The strongest pair is ${pair.a.hex} with ${pair.b.hex} at ${formatRatio(pair.ratio)}. Pixel counts can't tell which colours actually sit behind text, so this is a prompt to check, not a verdict.`,
      recommendation:
        "Find the body copy and small labels and test their real text and background colours in the analyzer's contrast picker. If they are among these colours, darken the text or lighten the ground until the pair reaches 4.5:1 (3:1 for text 24 px and up).",
      rationale: "Text below 4.5:1 fails WCAG AA at normal sizes and is hard to read in print, on projectors and from a distance.",
      preserve: "Large display type may stay as it is if it reaches 3:1.",
      priority: "medium",
      confidence: "low",
      evidenceType: "measured",
      evidence: [
        { label: "Strongest main pair", value: `${pair.a.hex} / ${pair.b.hex}` },
        { label: "Contrast", value: formatRatio(pair.ratio) },
      ],
    });
  }

  // 6. Tonal range
  const rs = R.structure.lumaStdDev;
  const cs = C.structure.lumaStdDev;
  if (cs < rs * THRESHOLDS.tonalRatio && rs - cs > 0.05) {
    out.push({
      rule: "tonal-range",
      category: "hierarchy",
      title: "Flatter tonal range than the reference",
      observation: `RMS contrast (standard deviation of lightness) is ${cs.toFixed(3)} in the current design against ${rs.toFixed(3)} in the reference.`,
      recommendation: "Push the darkest and lightest values further apart — usually the headline and the ground — so the main element separates from the rest.",
      rationale: "When values bunch together, nothing stands out first and the piece reads as one grey mass from a distance.",
      preserve: "Keep the hues; adjust lightness only.",
      priority: "medium",
      confidence: "medium",
      evidenceType: "measured",
      evidence: [
        { label: "RMS contrast, reference", value: rs.toFixed(3) },
        { label: "RMS contrast, current", value: cs.toFixed(3) },
      ],
    });
  }

  // 7. Busyness
  const re = R.structure.edgeDensity;
  const ce = C.structure.edgeDensity;
  if (Math.abs(ce - re) > THRESHOLDS.edgeAbs && (ce > re * THRESHOLDS.edgeRatio || re > ce * THRESHOLDS.edgeRatio)) {
    const busier = ce > re;
    out.push({
      rule: "edge-density",
      category: "layout",
      title: busier ? "Much busier than the reference" : "Much sparser than the reference",
      observation: `${pct(ce, 1)} of the current design's pixels sit on a hard edge, against ${pct(re, 1)} in the reference (Sobel, threshold 0.25, at ${C.analysisSize.width}×${C.analysisSize.height}).`,
      recommendation: busier
        ? "Remove or group secondary elements, enlarge the gaps between groups, and cut decorative texture behind text."
        : "If the reference's density is part of the look, add the missing supporting detail; otherwise this may simply be a calmer variation.",
      rationale: "Edge density is a proxy for visual noise. It doesn't say which elements are at fault — only that the overall texture differs a lot.",
      preserve: "Keep the headline and primary image intact while editing the supporting detail.",
      priority: "medium",
      confidence: "medium",
      evidenceType: "measured",
      evidence: [
        { label: "Edge density, reference", value: pct(re, 1) },
        { label: "Edge density, current", value: pct(ce, 1) },
      ],
    });
  }

  // 8. Open space
  const rq = R.structure.quietShare;
  const cq = C.structure.quietShare;
  if (Math.abs(rq - cq) > THRESHOLDS.quietDiff) {
    const less = cq < rq;
    out.push({
      rule: "quiet-space",
      category: "layout",
      title: less ? "Less open space than the reference" : "More open space than the reference",
      observation: `About ${pct(cq)} of the current design is flat, low-detail area, against ${pct(rq)} in the reference (16×16 grid; a cell counts when it has almost no edges or tonal variation).`,
      recommendation: less
        ? "Find the reference's largest empty region and reserve the same zone in the current design; move or shrink what fills it."
        : "Check that the empty area is intentional and anchors the composition rather than looking unfinished.",
      rationale: "Negative space is a large part of what makes editorial layouts feel calm and confident.",
      preserve: "Keep the content itself; this is about where it sits.",
      priority: "low",
      confidence: "low",
      evidenceType: "estimated",
      evidence: [
        { label: "Quiet area, reference", value: pct(rq) },
        { label: "Quiet area, current", value: pct(cq) },
      ],
    });
  }

  // 9. Centre of detail
  const dx = C.structure.detailCentroid.x - R.structure.detailCentroid.x;
  const dy = C.structure.detailCentroid.y - R.structure.detailCentroid.y;
  const shift = Math.hypot(dx, dy);
  if (shift > THRESHOLDS.centroidShift) {
    out.push({
      rule: "centroid",
      category: "hierarchy",
      title: "The centre of detail has moved",
      observation: `The detail-weighted centre sits at ${pct(C.structure.detailCentroid.x)} across, ${pct(C.structure.detailCentroid.y)} down; in the reference it is at ${pct(R.structure.detailCentroid.x)}, ${pct(R.structure.detailCentroid.y)}. It has moved ${direction(dx, dy)}.`,
      recommendation:
        "Compare where the main element sits in each piece. If the reference's anchor point matters to the look, move the headline or key image back toward it.",
      rationale: "Where detail concentrates is usually where the eye lands first. This is a measurement of edges, not of meaning, so treat it as a pointer.",
      preserve: "Keep the reading order of title, details and call to action.",
      priority: "low",
      confidence: "medium",
      evidenceType: "measured",
      evidence: [
        { label: "Reference centre", value: `${pct(R.structure.detailCentroid.x)}, ${pct(R.structure.detailCentroid.y)}` },
        { label: "Current centre", value: `${pct(C.structure.detailCentroid.x)}, ${pct(C.structure.detailCentroid.y)}` },
      ],
    });
  }

  return out;
}

export function buildLocalIssues(ctx: RuleContext, reviewId: string): ReviewIssue[] {
  return sortIssues(runRules(ctx).map(({ rule, ...d }) => ({ ...d, id: `${reviewId}:${rule}`, source: "local" as const, resolved: false })));
}
