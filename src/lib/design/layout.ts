import type { FontRef, TextLayer } from "./schema";

/**
 * Text layout for poster text boxes: explicit line breaks, then greedy word wrap to the box width.
 *
 * Measuring is injected so the same code runs in the browser (canvas `measureText` with the real fonts) and in Node
 * tests (`approxMeasure`). The editor, the SVG renderer and PNG export all lay text out through here, so a line
 * breaks in the same place on screen and in every export.
 */

export type FontSpec = { font: FontRef; size: number; weight: number; italic: boolean };
export type Measure = (text: string, spec: FontSpec) => number;

export type TextLine = { text: string; width: number };
export type TextLayout = {
  lines: TextLine[];
  /** Distance between baselines, px. */
  lineHeight: number;
  /** Baseline of the first line, relative to the layer's top edge. */
  firstBaseline: number;
  /** Height of the laid-out block. May exceed the layer's box: text is never clipped silently. */
  blockHeight: number;
  /** True when the block is taller than the box, so the editor can say so. */
  overflows: boolean;
};

/** Deterministic stand-in for tests and server code: every character is 0.55 em wide. */
export const approxMeasure: Measure = (text, spec) => [...text].length * spec.size * 0.55;

/** Where the alphabetic baseline sits inside one line box, as a fraction of the font size past the half-leading. */
export const ASCENT = 0.8;

export function layoutText(layer: Pick<TextLayer, "text" | "font" | "size" | "weight" | "italic" | "lineHeight" | "letterSpacing" | "w" | "h" | "valign">, measure: Measure): TextLayout {
  const spec: FontSpec = { font: layer.font, size: layer.size, weight: layer.weight, italic: layer.italic };
  const spacing = layer.letterSpacing * layer.size;
  const width = (s: string) => measure(s, spec) + spacing * Math.max(0, [...s].length - 1);
  const max = layer.w;
  const lines: TextLine[] = [];

  for (const paragraph of layer.text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = paragraph.split(/(\s+)/).filter((t) => t.length > 0);
    if (!words.length) {
      lines.push({ text: "", width: 0 });
      continue;
    }
    let line = "";
    for (const token of words) {
      const candidate = line + token;
      if (line && width(candidate.trimEnd()) <= max) {
        line = candidate;
        continue;
      }
      if (/^\s+$/.test(token)) {
        // A space at the break point is dropped, not carried to the next line.
        if (line) lines.push(finish(line));
        line = "";
        continue;
      }
      if (line) lines.push(finish(line));
      line = token;
      // A single word wider than the box is split by characters rather than overflowing sideways.
      while (width(line) > max && [...line].length > 1) {
        const chars = [...line];
        let k = chars.length - 1;
        while (k > 1 && width(chars.slice(0, k).join("")) > max) k--;
        lines.push(finish(chars.slice(0, k).join("")));
        line = chars.slice(k).join("");
      }
    }
    lines.push(finish(line));
  }

  function finish(s: string): TextLine {
    const t = s.replace(/\s+$/, "");
    return { text: t, width: t ? width(t) : 0 };
  }

  const lineHeight = layer.size * layer.lineHeight;
  const blockHeight = lines.length * lineHeight;
  const free = layer.h - blockHeight;
  const top = layer.valign === "middle" ? free / 2 : layer.valign === "bottom" ? free : 0;
  return {
    lines,
    lineHeight,
    firstBaseline: Math.max(layer.valign === "top" ? 0 : -Infinity, top) + (lineHeight - layer.size) / 2 + layer.size * ASCENT,
    blockHeight,
    overflows: blockHeight > layer.h + 0.5,
  };
}
