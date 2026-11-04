/**
 * Fonts a design can use without the user adding one. The first three also set the app's interface; the ten poster
 * families are for artwork only and load when a design uses them.
 * Every family here is self-hosted under the SIL Open Font
 * License, with its licence text next to the files in src/app/fonts. Add a family here (and its files and licence)
 * to make it available everywhere: editor menus, schema validation, SVG/PNG export and templates.
 *
 * `cssVar` is the next/font variable set on <html> in src/app/layout.tsx; `files` are the faces export embeds.
 */
export type BuiltinFont = {
  label: string;
  weights: readonly number[];
  italic: boolean;
  /** Weights that have an italic face; defaults to all of `weights` when the family has italics. */
  italicWeights?: readonly number[];
  cssVar: string;
  fallback: string;
  /** Faces under src/app/fonts, for embedding in exported SVG. A variable font lists one file for its range. */
  files: ReadonlyArray<{ file: string; weight: string; style: "normal" | "italic" }>;
  /** Where it came from, for the licence check. */
  source: string;
};

export const BUILTIN_FONTS = {
  lora: {
    label: "Lora",
    weights: [400, 500, 600, 700],
    italic: true,
    cssVar: "--font-lora",
    fallback: "Georgia, serif",
    files: [
      { file: "Lora-Variable.ttf", weight: "400 700", style: "normal" },
      { file: "Lora-Italic-Variable.ttf", weight: "400 700", style: "italic" },
    ],
    source: "github.com/google/fonts (ofl/lora)",
  },
  "be-vietnam-pro": {
    label: "Be Vietnam Pro",
    weights: [400, 500, 600],
    italic: true,
    italicWeights: [400],
    cssVar: "--font-be-vietnam",
    fallback: "system-ui, sans-serif",
    files: [
      { file: "BeVietnamPro-Regular.ttf", weight: "400", style: "normal" },
      { file: "BeVietnamPro-Italic.ttf", weight: "400", style: "italic" },
      { file: "BeVietnamPro-Medium.ttf", weight: "500", style: "normal" },
      { file: "BeVietnamPro-SemiBold.ttf", weight: "600", style: "normal" },
    ],
    source: "github.com/google/fonts (ofl/bevietnampro)",
  },
  "ibm-plex-mono": {
    label: "IBM Plex Mono",
    weights: [400, 500],
    italic: false,
    cssVar: "--font-plex-mono",
    fallback: "ui-monospace, monospace",
    files: [
      { file: "IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
      { file: "IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    ],
    source: "github.com/google/fonts (ofl/ibmplexmono)",
  },
  anton: {
    label: "Anton",
    weights: [400],
    italic: false,
    cssVar: "--font-anton",
    fallback: "Impact, sans-serif",
    files: [{ file: "Anton-Regular.ttf", weight: "400", style: "normal" }],
    source: "github.com/google/fonts (ofl/anton)",
  },
  archivo: {
    label: "Archivo",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: true,
    cssVar: "--font-archivo",
    fallback: "system-ui, sans-serif",
    files: [
      { file: "Archivo-Variable.ttf", weight: "100 900", style: "normal" },
      { file: "Archivo-Italic-Variable.ttf", weight: "100 900", style: "italic" },
    ],
    source: "github.com/google/fonts (ofl/archivo)",
  },
  fraunces: {
    label: "Fraunces",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: true,
    cssVar: "--font-fraunces",
    fallback: "Georgia, serif",
    files: [
      { file: "Fraunces-Variable.ttf", weight: "100 900", style: "normal" },
      { file: "Fraunces-Italic-Variable.ttf", weight: "100 900", style: "italic" },
    ],
    source: "github.com/google/fonts (ofl/fraunces)",
  },
  "playfair-display": {
    label: "Playfair Display",
    weights: [400, 500, 600, 700, 800, 900],
    italic: true,
    cssVar: "--font-playfair",
    fallback: "Georgia, serif",
    files: [
      { file: "PlayfairDisplay-Variable.ttf", weight: "400 900", style: "normal" },
      { file: "PlayfairDisplay-Italic-Variable.ttf", weight: "400 900", style: "italic" },
    ],
    source: "github.com/google/fonts (ofl/playfairdisplay)",
  },
  oswald: {
    label: "Oswald",
    weights: [300, 400, 500, 600, 700],
    italic: false,
    cssVar: "--font-oswald",
    fallback: "Impact, sans-serif",
    files: [{ file: "Oswald-Variable.ttf", weight: "200 700", style: "normal" }],
    source: "github.com/google/fonts (ofl/oswald)",
  },
  "barlow-condensed": {
    label: "Barlow Condensed",
    weights: [400, 700],
    italic: true,
    cssVar: "--font-barlow-condensed",
    fallback: "system-ui, sans-serif",
    files: [
      { file: "BarlowCondensed-Regular.ttf", weight: "400", style: "normal" },
      { file: "BarlowCondensed-Italic.ttf", weight: "400", style: "italic" },
      { file: "BarlowCondensed-Bold.ttf", weight: "700", style: "normal" },
      { file: "BarlowCondensed-BoldItalic.ttf", weight: "700", style: "italic" },
    ],
    source: "github.com/google/fonts (ofl/barlowcondensed)",
  },
  bungee: {
    label: "Bungee",
    weights: [400],
    italic: false,
    cssVar: "--font-bungee",
    fallback: "Impact, sans-serif",
    files: [{ file: "Bungee-Regular.ttf", weight: "400", style: "normal" }],
    source: "github.com/google/fonts (ofl/bungee)",
  },
  "space-grotesk": {
    label: "Space Grotesk",
    weights: [300, 400, 500, 600, 700],
    italic: false,
    cssVar: "--font-space-grotesk",
    fallback: "system-ui, sans-serif",
    files: [{ file: "SpaceGrotesk-Variable.ttf", weight: "300 700", style: "normal" }],
    source: "github.com/google/fonts (ofl/spacegrotesk)",
  },
  unbounded: {
    label: "Unbounded",
    weights: [300, 400, 500, 600, 700, 800, 900],
    italic: false,
    cssVar: "--font-unbounded",
    fallback: "system-ui, sans-serif",
    files: [{ file: "Unbounded-Variable.ttf", weight: "200 900", style: "normal" }],
    source: "github.com/google/fonts (ofl/unbounded)",
  },
  "dancing-script": {
    label: "Dancing Script",
    weights: [400, 500, 600, 700],
    italic: false,
    cssVar: "--font-dancing-script",
    fallback: "cursive",
    files: [{ file: "DancingScript-Variable.ttf", weight: "400 700", style: "normal" }],
    source: "github.com/google/fonts (ofl/dancingscript)",
  },
} as const satisfies Record<string, BuiltinFont>;

export type BuiltinFontId = keyof typeof BUILTIN_FONTS;
export const BUILTIN_FONT_IDS = Object.keys(BUILTIN_FONTS) as BuiltinFontId[];

/** Whether a family ships an italic at this weight (so the editor never asks the browser to fake one). */
export function hasItalic(id: BuiltinFontId, weight: number): boolean {
  const f: BuiltinFont = BUILTIN_FONTS[id];
  return f.italic && (f.italicWeights ?? f.weights).includes(weight);
}

/** Nearest weight the family ships, so a template asking for 700 in a 600-max family doesn't get faux bold. */
export function nearestWeight(id: BuiltinFontId, weight: number): number {
  const ws = BUILTIN_FONTS[id].weights as readonly number[];
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0] ?? 400);
}
