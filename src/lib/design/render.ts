import { layoutText, type Measure } from "./layout";
import { effectSvg } from "./effects";
import { BUILTIN_FONTS, isBuiltinFont, PATH_UNITS, type DesignDoc, type FontRef, type ImageLayer, type Layer, type ShapeLayer, type TextLayer } from "./schema";

/**
 * Renders a design document to one SVG string. This is the only renderer: the editor shows it, SVG export saves it,
 * PNG export rasterises it. Everything that varies by environment is injected:
 *
 * - `measure` lays text out (canvas measureText in the browser, approxMeasure in tests);
 * - `fontFamily` names a font for CSS (document fonts on screen, embedded @font-face names in an export);
 * - `image` gives an href for a resource (blob: URL on screen, data: URL in an export), or null when it's missing.
 *
 * Empty image slots and missing images draw a labelled placeholder only when `placeholders` is true (the editor).
 * Exports leave them out, and export.ts refuses to export a document whose images are missing.
 */
export type RenderOptions = {
  measure: Measure;
  fontFamily?: (font: FontRef) => string;
  image?: (resourceId: string) => string | null;
  placeholders?: boolean;
  /** CSS put in a <style> element, e.g. embedded @font-face rules for export. */
  css?: string;
  /** Prefix for clip-path ids, so two SVGs inlined in one page don't collide. */
  idPrefix?: string;
};

export const defaultFontFamily = (font: FontRef): string =>
  isBuiltinFont(font) ? `var(${BUILTIN_FONTS[font].cssVar}), ${BUILTIN_FONTS[font].fallback}` : `"${font}", system-ui, sans-serif`;

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

const r = (v: number, digits = 2) => (Number.isInteger(v) ? String(v) : v.toFixed(digits).replace(/\.?0+$/, ""));

function frame(l: Layer): string {
  const attrs: string[] = [];
  if (l.rotation) attrs.push(`transform="rotate(${r(l.rotation)} ${r(l.x + l.w / 2)} ${r(l.y + l.h / 2)})"`);
  if (l.opacity < 1) attrs.push(`opacity="${r(l.opacity)}"`);
  return attrs.join(" ");
}

function textSvg(l: TextLayer, o: RenderOptions): string {
  const layout = layoutText(l, o.measure);
  const family = (o.fontFamily ?? defaultFontFamily)(l.font);
  const anchor = l.align === "center" ? "middle" : l.align === "right" ? "end" : "start";
  const x = l.align === "center" ? l.x + l.w / 2 : l.align === "right" ? l.x + l.w : l.x;
  const tspans = layout.lines
    .map((line, i) => `<tspan x="${r(x)}" y="${r(l.y + layout.firstBaseline + i * layout.lineHeight)}">${escapeXml(line.text) || " "}</tspan>`)
    .join("");
  const style = [
    `font-family:${escapeXml(family).replace(/&quot;/g, "'")}`,
    `font-size:${r(l.size)}px`,
    `font-weight:${l.weight}`,
    l.italic ? "font-style:italic" : "",
    l.letterSpacing ? `letter-spacing:${r(l.letterSpacing)}em` : "",
    "white-space:pre",
  ]
    .filter(Boolean)
    .join(";");
  return `<text data-layer="${l.id}" fill="${l.color}" text-anchor="${anchor}" style="${style}" ${frame(l)}>${tspans}</text>`;
}

function shapeSvg(l: ShapeLayer): string {
  const stroke = l.stroke && l.strokeWidth > 0 ? ` stroke="${l.stroke}" stroke-width="${r(l.strokeWidth)}"` : "";
  const fill = ` fill="${l.fill ?? "none"}"`;
  if (l.shape === "ellipse")
    return `<ellipse data-layer="${l.id}" cx="${r(l.x + l.w / 2)}" cy="${r(l.y + l.h / 2)}" rx="${r(l.w / 2)}" ry="${r(l.h / 2)}"${fill}${stroke} ${frame(l)}/>`;
  if (l.shape === "path") {
    if (!l.path) return "";
    // The path is drawn in a 1000-unit box scaled to the layer; non-scaling-stroke keeps the stroke width in canvas px.
    const sx = l.w / PATH_UNITS;
    const sy = l.h / PATH_UNITS;
    const sw = stroke ? ` vector-effect="non-scaling-stroke"` : "";
    return `<g data-layer="${l.id}" ${frame(l)}><path d="${escapeXml(l.path)}" transform="translate(${r(l.x)} ${r(l.y)}) scale(${r(sx, 5)} ${r(sy, 5)})"${fill}${stroke}${sw}/></g>`;
  }
  if (l.shape === "line") {
    // A rule across the box at its vertical centre; its weight is the stroke width, or the box height without one.
    const y = l.y + l.h / 2;
    const colour = l.stroke ?? l.fill ?? "#202323";
    const weight = l.strokeWidth > 0 ? l.strokeWidth : l.h;
    return `<line data-layer="${l.id}" x1="${r(l.x)}" y1="${r(y)}" x2="${r(l.x + l.w)}" y2="${r(y)}" stroke="${colour}" stroke-width="${r(weight)}" ${frame(l)}/>`;
  }
  const rx = Math.min(l.radius, l.w / 2, l.h / 2);
  return `<rect data-layer="${l.id}" x="${r(l.x)}" y="${r(l.y)}" width="${r(l.w)}" height="${r(l.h)}"${rx ? ` rx="${r(rx)}"` : ""}${fill}${stroke} ${frame(l)}/>`;
}

function placeholder(l: Layer, label: string): string {
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const size = Math.max(12, Math.min(48, l.w / 12));
  return (
    `<g data-layer="${l.id}" data-placeholder="true" ${frame(l)}>` +
    `<rect x="${r(l.x)}" y="${r(l.y)}" width="${r(l.w)}" height="${r(l.h)}" fill="#e8e5de" stroke="#b9b5ac" stroke-width="${r(Math.max(1, size / 12))}" stroke-dasharray="${r(size / 2)} ${r(size / 3)}"/>` +
    `<text x="${r(cx)}" y="${r(cy + size * 0.35)}" text-anchor="middle" fill="#6b6d66" style="font-family:${defaultFontFamily("be-vietnam-pro").replace(/"/g, "'")};font-size:${r(size)}px">${escapeXml(label)}</text>` +
    `</g>`
  );
}

function imageSvg(l: ImageLayer, o: RenderOptions, clipId: string): string {
  const href = l.resourceId ? (o.image?.(l.resourceId) ?? null) : null;
  if (!href) return o.placeholders ? placeholder(l, l.resourceId ? "Image missing" : "Add an image") : "";
  const par = l.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet";
  const rx = Math.min(l.radius, l.w / 2, l.h / 2);
  // Cover crops to the box, so the box is always the clip; the radius rounds that clip.
  return (
    `<g data-layer="${l.id}" ${frame(l)}>` +
    `<clipPath id="${clipId}"><rect x="${r(l.x)}" y="${r(l.y)}" width="${r(l.w)}" height="${r(l.h)}"${rx ? ` rx="${r(rx)}"` : ""}/></clipPath>` +
    `<image href="${escapeXml(href)}" x="${r(l.x)}" y="${r(l.y)}" width="${r(l.w)}" height="${r(l.h)}" preserveAspectRatio="${par}" clip-path="url(#${clipId})"/>` +
    `</g>`
  );
}

export function renderLayer(l: Layer, o: RenderOptions, index = 0): string {
  if (l.hidden) return "";
  if (l.type === "text") return textSvg(l, o);
  if (l.type === "shape") return shapeSvg(l);
  if (l.type === "effect") return effectSvg(l, `${o.idPrefix ?? "fp"}-fx-${index}`, frame(l));
  return imageSvg(l, o, `${o.idPrefix ?? "fp"}-clip-${index}`);
}

export function renderSvg(doc: DesignDoc, o: RenderOptions): string {
  const body = doc.layers.map((l, i) => renderLayer(l, o, i)).join("");
  const style = o.css ? `<style>${o.css}</style>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}">` +
    `<title>${escapeXml(doc.name)}</title>${style}` +
    `<rect width="${doc.width}" height="${doc.height}" fill="${doc.background}"/>` +
    body +
    `</svg>`
  );
}
