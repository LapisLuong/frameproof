import { z } from "zod";
import { contrastRatio } from "../color/contrast";
import { hexToRgb } from "../color/convert";
import { FontRefSchema, HexSchema } from "./schema";
import { TEMPLATE_CONCEPTS } from "./library";

/**
 * Art direction: the choices a concept is composed from. Every value records where it came from, so the UI can say
 * so and nothing is presented as measured when it wasn't:
 *
 * - "measured": computed from the user's reference pixels (palette k-means in src/lib/analysis);
 * - "manual": the user chose or adjusted it;
 * - "ai-suggested": a vision model proposed it (server-side, only when configured). Fonts and layout can never be
 *   "measured" — they can't be read reliably from pixels.
 */
export const ORIGINS = ["measured", "manual", "ai-suggested"] as const;
export type Origin = (typeof ORIGINS)[number];

/** How a colour is used when composing: background, main type colour, the one loud colour, everything else. */
export const COLOUR_ROLES = ["ground", "ink", "accent", "support"] as const;
export type ColourRole = (typeof COLOUR_ROLES)[number];

export const SwatchSchema = z.object({
  hex: HexSchema,
  role: z.enum(COLOUR_ROLES),
  origin: z.enum(ORIGINS),
  /** Share of the reference's opaque pixels, when measured. */
  share: z.number().min(0).max(1).optional(),
});
export type Swatch = z.infer<typeof SwatchSchema>;

export const ArtDirectionSchema = z.object({
  palette: z.array(SwatchSchema).min(2).max(8),
  fonts: z.object({
    display: FontRefSchema,
    text: FontRefSchema,
    origin: z.enum(["manual", "ai-suggested"]),
  }),
  /** Concept families to try, in order of preference. */
  concepts: z.array(z.enum(TEMPLATE_CONCEPTS)).min(1).max(TEMPLATE_CONCEPTS.length),
  conceptsOrigin: z.enum(["manual", "ai-suggested"]),
  /** Short notes on the direction, e.g. from the AI or the user. Shown, never measured. */
  notes: z.string().max(600).default(""),
});
export type ArtDirection = z.infer<typeof ArtDirectionSchema>;

/** The user's content for the poster. Lines are set in the order given (dates, venue, credits…). */
export const BriefSchema = z.object({
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(200).default(""),
  lines: z.array(z.string().trim().min(1).max(160)).max(8).default([]),
  /** Free-text intent, e.g. "quiet, museum-like, for a ceramics show". */
  intent: z.string().trim().max(600).default(""),
});
export type Brief = z.infer<typeof BriefSchema>;

/** How each concept was put together, for the "how this was made" note on each result. */
export type ComposeMethod = { kind: "deterministic"; templateId: string } | { kind: "ai-directed"; templateId: string; model: string };

/**
 * Turn swatches measured from the user's references into a palette with roles. The colours and shares are measured;
 * the roles are a rule (estimated), and the UI lets the user change them:
 * the largest area is the ground; the colour with the best contrast against it is the ink; the most saturated
 * remaining colour with Oklab chroma ≥ 0.08 is the accent; the rest support. Swatches under 2% are left out.
 */
export function paletteFromMeasured(swatches: Array<{ hex: string; share: number; chroma: number }>, max = 6): Swatch[] {
  const list = swatches.filter((s) => s.share >= 0.02).slice(0, max);
  if (!list.length) return [];
  const [ground, ...rest] = [...list].sort((a, b) => b.share - a.share);
  const g = hexToRgb(ground!.hex)!;
  const byContrast = [...rest].sort((a, b) => contrastRatio(hexToRgb(b.hex)!, g) - contrastRatio(hexToRgb(a.hex)!, g));
  const ink = byContrast[0];
  const accent = rest.filter((s) => s !== ink && s.chroma >= 0.08).sort((a, b) => b.chroma - a.chroma)[0];
  const out: Swatch[] = [{ hex: ground!.hex.toLowerCase(), role: "ground", origin: "measured", share: ground!.share }];
  if (ink) out.push({ hex: ink.hex.toLowerCase(), role: "ink", origin: "measured", share: ink.share });
  if (accent) out.push({ hex: accent.hex.toLowerCase(), role: "accent", origin: "measured", share: accent.share });
  for (const s of rest) if (s !== ink && s !== accent) out.push({ hex: s.hex.toLowerCase(), role: "support", origin: "measured", share: s.share });
  return out;
}

/** A starting direction when there are no references: the app's own paper, ink and proof red, marked manual. */
export const DEFAULT_PALETTE: Swatch[] = [
  { hex: "#f1ece2", role: "ground", origin: "manual" },
  { hex: "#1f2421", role: "ink", origin: "manual" },
  { hex: "#c65a42", role: "accent", origin: "manual" },
  { hex: "#7d8c84", role: "support", origin: "manual" },
];
