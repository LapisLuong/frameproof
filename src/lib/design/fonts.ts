/**
 * Fonts a design can use without the user adding one. The first three also set the app's interface; the poster
 * families (Anton, Archivo, Fraunces, Playfair Display) are for artwork only and load when a design uses them.
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
} as const satisfies Record<string, BuiltinFont>;

export type BuiltinFontId = keyof typeof BUILTIN_FONTS;
export const BUILTIN_FONT_IDS = Object.keys(BUILTIN_FONTS) as BuiltinFontId[];

/** Nearest weight the family ships, so a template asking for 700 in a 600-max family doesn't get faux bold. */
export function nearestWeight(id: BuiltinFontId, weight: number): number {
  const ws = BUILTIN_FONTS[id].weights as readonly number[];
  return ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0] ?? 400);
}
