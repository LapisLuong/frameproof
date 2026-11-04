"use client";

import { approxMeasure, type FontSpec, type Measure } from "./layout";
import { BUILTIN_FONTS, isBuiltinFont, type DesignDoc, type FontRef } from "./schema";

/**
 * Browser side of the renderer: real text measuring with the loaded fonts, and making sure the faces a document
 * uses are loaded before it's measured (otherwise lines would break with fallback metrics, then jump).
 */

const familyCache = new Map<string, string>();

/** CSS font-family list for a font, as the document knows it (next/font gives hashed family names). */
export function cssFamily(font: FontRef): string {
  if (!isBuiltinFont(font)) return `"fp-${font}", system-ui, sans-serif`;
  const cached = familyCache.get(font);
  if (cached) return cached;
  const info = BUILTIN_FONTS[font];
  const value = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(info.cssVar).trim();
  const family = `${value || info.label}, ${info.fallback}`;
  if (value) familyCache.set(font, family);
  return family;
}

const fontString = (spec: FontSpec, family = cssFamily(spec.font)) => `${spec.italic ? "italic " : ""}${spec.weight} ${spec.size}px ${family}`;

let ctx: CanvasRenderingContext2D | null = null;
export const measureText: Measure = (text, spec) => {
  // During server rendering there is no canvas; the client re-measures with real fonts once they load.
  if (typeof document === "undefined") return approxMeasure(text, spec);
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return approxMeasure(text, spec);
  ctx.font = fontString(spec);
  return ctx.measureText(text).width;
};

/** Load every face the document's text uses. Resolves even if a face fails, so a broken font never blocks editing. */
export async function loadDocFonts(doc: DesignDoc): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const wanted = new Map<string, string>();
  for (const l of doc.layers) {
    if (l.type !== "text" || l.hidden) continue;
    const spec = { font: l.font, size: 32, weight: l.weight, italic: l.italic };
    const key = fontString(spec);
    wanted.set(key, (wanted.get(key) ?? "") + l.text.slice(0, 200));
  }
  await Promise.all([...wanted].map(([font, text]) => document.fonts.load(font, text || "Aa").catch(() => [])));
}

/** Register a user font (a Resource) under the family name cssFamily() gives it. */
const registered = new Set<string>();
export async function registerUserFont(id: string, blob: Blob): Promise<void> {
  if (registered.has(id) || typeof FontFace === "undefined") return;
  const face = new FontFace(`fp-${id}`, await blob.arrayBuffer());
  await face.load();
  document.fonts.add(face);
  registered.add(id);
}
