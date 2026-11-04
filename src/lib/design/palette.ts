import { hexToRgb, rgbToHex, rgbToOklab, chroma } from "../color/convert";
import { contrastRatio } from "../color/contrast";
import { HexSchema, type DesignDoc, type TextLayer } from "./schema";
import type { ColourRole, Swatch } from "./direction";

export type Hsl = { h: number; s: number; l: number };
export type PaletteDelta = Partial<Hsl>;
const clamp = (v: number) => Math.max(0, Math.min(100, v));
const rgb = (hex: string) => { const v = hexToRgb(HexSchema.parse(hex)); if (!v) throw new Error("Invalid colour"); return v; };
const lab = (hex: string) => rgbToOklab(rgb(hex));
export function hexToHsl(hex: string): Hsl {
  const c = rgb(hex); const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  const h = !d ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: d ? d / (1 - Math.abs(2 * l - 1)) * 100 : 0, l: l * 100 };
}
export function hslToHex({ h, s, l }: Hsl): string {
  if (![h, s, l].every(Number.isFinite)) throw new Error("HSL must be finite");
  h = ((h % 360) + 360) % 360; s = clamp(s) / 100; l = clamp(l) / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return rgbToHex({ r: channel(0), g: channel(8), b: channel(4) }).toLowerCase();
}
export function adjustSwatch(hex: string, delta: PaletteDelta): string {
  const c = hexToHsl(hex);
  return hslToHex({ h: c.h + (delta.h ?? 0), s: c.s + (delta.s ?? 0), l: c.l + (delta.l ?? 0) });
}
export const adjustPalette = (hexes: string[], delta: PaletteDelta): string[] => hexes.map((hex) => adjustSwatch(hex, delta));
type UseRole = "background" | "text" | "fill" | "stroke";
export function docColours(doc: DesignDoc): Array<{ hex: string; uses: number; roles: UseRole[] }> {
  const colours = new Map<string, { hex: string; uses: number; roles: UseRole[] }>();
  const add = (hex: string, roles: UseRole[]) => {
    hex = HexSchema.parse(hex); const entry = colours.get(hex) ?? { hex, uses: 0, roles: [] };
    entry.uses++; for (const role of roles) if (!entry.roles.includes(role)) entry.roles.push(role);
    colours.set(hex, entry);
  };
  add(doc.background, ["background"]);
  for (const layer of doc.layers) {
    if (layer.type === "text") add(layer.color, ["text"]);
    if (layer.type === "effect") add(layer.color, ["fill"]);
    if (layer.type === "shape") {
      if (layer.fill && layer.stroke && layer.fill.toLowerCase() === layer.stroke.toLowerCase()) add(layer.fill, ["fill", "stroke"]);
      else { if (layer.fill) add(layer.fill, ["fill"]); if (layer.stroke) add(layer.stroke, ["stroke"]); }
    }
  }
  return [...colours.values()].sort((a, b) => a.hex.localeCompare(b.hex));
}
/** Estimated heuristic: ground first; largest text w*h*size is ink; highest OKLCH chroma >= .08
 * among remaining colours is accent; light effects also use accent. Remaining colours support.
 * Texture-only colours have no inferred role and are excluded from direction mapping. Ties use ascending hex order. */
export function inferColourRoles(doc: DesignDoc): Record<string, ColourRole> {
  // Texture-only colours are deliberately absent: direction mapping leaves them unchanged.
  const colourDoc = { ...doc, layers: doc.layers.filter((l) => l.type !== "effect" || (l.effect !== "grain" && l.effect !== "vignette")) };
  const roles: Record<string, ColourRole> = Object.fromEntries(docColours(colourDoc).map(({ hex }) => [hex, "support"]));
  const ground = doc.background.toLowerCase(); roles[ground] = "ground";
  const texts = doc.layers.filter((l): l is TextLayer => l.type === "text" && l.color.toLowerCase() !== ground).sort((a, b) => b.w * b.h * b.size - a.w * a.h * a.size || a.color.localeCompare(b.color));
  if (texts[0]) roles[texts[0].color.toLowerCase()] = "ink";
  const accents = Object.keys(roles).filter((hex) => roles[hex] === "support" && chroma(lab(hex)) >= .08).sort((a, b) => chroma(lab(b)) - chroma(lab(a)) || a.localeCompare(b));
  if (accents[0]) roles[accents[0]] = "accent";
  // Oklab L >= .7 is an estimated light-colour threshold; ground and ink retain precedence.
  for (const l of colourDoc.layers) if (l.type === "effect" && lab(l.color).L >= .7) {
    const hex = l.color.toLowerCase();
    if (roles[hex] === "support") roles[hex] = "accent";
  }
  return roles;
}
export function applyColourMap(doc: DesignDoc, map: Record<string, string>): DesignDoc {
  const normalized = new Map(Object.entries(map).map(([a, b]) => [HexSchema.parse(a), HexSchema.parse(b)]));
  const replace = (hex: string) => normalized.get(hex.toLowerCase()) ?? hex;
  const background = replace(doc.background);
  const layers = doc.layers.map((l) => {
    if (l.type === "text" || l.type === "effect") { const color = replace(l.color); return color === l.color ? l : { ...l, color }; }
    if (l.type === "shape") { const fill = l.fill && replace(l.fill), stroke = l.stroke && replace(l.stroke); return fill === l.fill && stroke === l.stroke ? l : { ...l, fill, stroke }; }
    return l;
  });
  return background === doc.background && layers.every((l, i) => l === doc.layers[i]) ? doc : { ...doc, background, layers };
}
export function mapToDirection(doc: DesignDoc, palette: Swatch[]): Record<string, string> {
  if (!palette.length) return {};
  const roles = inferColourRoles(doc), map: Record<string, string> = {}; let support = 0;
  const nearest = (hex: string) => [...palette].sort((a, b) => Math.abs(lab(a.hex).L - lab(hex).L) - Math.abs(lab(b.hex).L - lab(hex).L) || a.hex.localeCompare(b.hex))[0]!;
  for (const [hex, role] of Object.entries(roles)) {
    const matches = palette.filter((s) => s.role === role);
    map[hex] = (matches.length ? matches[role === "support" ? support++ % matches.length : 0]! : nearest(hex)).hex;
  }
  const ground = map[doc.background.toLowerCase()]!;
  for (const [hex, role] of Object.entries(roles)) if (role === "ink" && contrastRatio(rgb(map[hex]!), rgb(ground)) < 4.5) {
    map[hex] = [...palette].sort((a, b) => contrastRatio(rgb(b.hex), rgb(ground)) - contrastRatio(rgb(a.hex), rgb(ground)) || a.hex.localeCompare(b.hex))[0]!.hex;
  }
  return map;
}
