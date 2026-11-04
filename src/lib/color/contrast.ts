import { relativeLuminance, type RGB } from "./convert";

/** WCAG 2.x contrast ratio between two opaque colours, 1..21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastGrade = {
  ratio: number;
  /** Normal text ≥ 4.5, large text ≥ 3 (WCAG 2.x AA). */
  aaNormal: boolean;
  aaLarge: boolean;
  /** Normal text ≥ 7, large text ≥ 4.5 (AAA). */
  aaaNormal: boolean;
  aaaLarge: boolean;
  /** Non-text UI components and graphics ≥ 3 (WCAG 1.4.11). */
  nonText: boolean;
};

export function gradeContrast(a: RGB, b: RGB): ContrastGrade {
  const ratio = contrastRatio(a, b);
  // WCAG compares against unrounded ratios; round only for display.
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    nonText: ratio >= 3,
  };
}

export function formatRatio(ratio: number): string {
  // Truncate (not round) to 2 decimals so 4.499 never displays as a passing 4.50.
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}
