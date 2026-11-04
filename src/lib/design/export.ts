import { z } from "zod";
import { BUILTIN_FONTS, DesignDocSchema, isBuiltinFont, referencedResources, type DesignDoc, type FontRef } from "./schema";
import { ResourceMetaSchema, MAX_FONT_BYTES, type Resource, type ResourceMeta } from "./resource";
import { type Measure } from "./layout";
import { renderSvg } from "./render";
import { sniffResource } from "./resource-validate";
import { validateImageBytes } from "../image/validate";

export type FontFile = { family: string; weight: string; style: "normal" | "italic"; mime: string; bytes: Uint8Array };
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    out += alphabet[a >> 2]! + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]! + (b === undefined ? "=" : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]) + (c === undefined ? "=" : alphabet[c & 63]);
  }
  return out;
}
function unbase64(s: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) throw new Error("Invalid base64 resource.");
  const out = new Uint8Array(s.length / 4 * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0));
  let n = 0;
  for (let i = 0; i < s.length; i += 4) {
    const v = (alphabet.indexOf(s[i]!) << 18) | (alphabet.indexOf(s[i + 1]!) << 12) | (Math.max(0, alphabet.indexOf(s[i + 2]!)) << 6) | Math.max(0, alphabet.indexOf(s[i + 3]!));
    for (const shift of [16, 8, 0]) if (n < out.length) out[n++] = (v >> shift) & 255;
  }
  if (base64(out) !== s) throw new Error("Invalid base64 padding.");
  return out;
}
export const exportFamily = (font: FontRef): string => `FP ${font}`;
const cssString = (s: string) => '"' + s.replace(/[\\"<\n\r]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `) + '"';
export function fontFaceCss(files: FontFile[]): string {
  return files.map((f) => `@font-face{font-family:${cssString(f.family)};font-weight:${f.weight};font-style:${f.style};src:url("data:${f.mime};base64,${base64(f.bytes)}")}`).join("\n");
}
export type ExportDeps = { measure: Measure; loadBuiltinFont(file: string): Promise<Uint8Array>; loadResource(id: string): Promise<{ mime: string; bytes: Uint8Array } | null> };
export class MissingResourcesError extends Error {
  constructor(public ids: string[]) { super(`Missing resources: ${ids.join(", ")}`); this.name = "MissingResourcesError"; }
}
export async function exportSvg(doc: DesignDoc, deps: ExportDeps): Promise<string> {
  doc = DesignDocSchema.parse(doc);
  const resources = new Map(await Promise.all(referencedResources(doc).map(async (id) => [id, await deps.loadResource(id)] as const)));
  const missing = [...resources].filter(([, r]) => !r).map(([id]) => id);
  if (missing.length) throw new MissingResourcesError(missing);
  const fonts: FontFile[] = [];
  const used = new Set<string>();
  for (const l of doc.layers) {
    if (l.type !== "text" || l.hidden) continue;
    if (isBuiltinFont(l.font)) {
      for (const face of BUILTIN_FONTS[l.font].files) {
        const range = face.weight.split(" ").map(Number);
        if (face.style !== (l.italic ? "italic" : "normal") || l.weight < range[0]! || l.weight > (range[1] ?? range[0]!)) continue;
        const key = `${l.font}/${face.file}`;
        if (used.has(key)) continue;
        used.add(key);
        fonts.push({ family: exportFamily(l.font), weight: face.weight, style: face.style, mime: "font/ttf", bytes: await deps.loadBuiltinFont(face.file) });
      }
    } else {
      const key = `${l.font}/${l.weight}/${l.italic}`;
      if (used.has(key)) continue;
      used.add(key);
      const r = resources.get(l.font)!;
      fonts.push({ ...r!, family: exportFamily(l.font), weight: String(l.weight), style: l.italic ? "italic" : "normal" });
    }
  }
  return renderSvg(doc, { measure: deps.measure, fontFamily: (f) => cssString(exportFamily(f)), css: fontFaceCss(fonts), placeholders: false, image: (id) => { const r = resources.get(id); return r ? `data:${r.mime};base64,${base64(r.bytes)}` : null; } });
}
export const BUNDLE_FORMAT = "frameproof.design-bundle";
export const BUNDLE_VERSION = 1;
export type Bundle = { format: typeof BUNDLE_FORMAT; version: typeof BUNDLE_VERSION; exportedAt: number; doc: DesignDoc; resources: Array<ResourceMeta & { data: string }> };
const BundleSchema = z.object({ format: z.literal(BUNDLE_FORMAT), version: z.literal(BUNDLE_VERSION), exportedAt: z.number().int().nonnegative(), doc: DesignDocSchema, resources: z.array(ResourceMetaSchema.extend({ data: z.string() })).max(400) });
export const MAX_BUNDLE_TEXT = 60 * 1024 * 1024;
export async function createBundle(doc: DesignDoc, resources: Resource[]): Promise<string> {
  const ids = new Set(referencedResources(doc));
  const entries = await Promise.all(resources.filter((r) => ids.has(r.id)).map(async ({ blob, ...meta }) => ({ ...meta, data: base64(new Uint8Array(await blob.arrayBuffer())) })));
  const text = JSON.stringify({ format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: Date.now(), doc, resources: entries });
  parseBundle(text);
  return text;
}
export function parseBundle(text: string): { doc: DesignDoc; resources: Array<{ meta: ResourceMeta; bytes: Uint8Array }> } {
  if (text.length > MAX_BUNDLE_TEXT || new TextEncoder().encode(text).length > MAX_BUNDLE_TEXT) throw new Error("The bundle exceeds the 60 MB limit.");
  const bundle = BundleSchema.parse(JSON.parse(text));
  const seen = new Set<string>();
  const resources = bundle.resources.map(({ data, ...meta }) => {
    if (seen.has(meta.id)) throw new Error("Duplicate resource id.");
    seen.add(meta.id);
    const bytes = unbase64(data);
    if (bytes.length !== meta.bytes || sniffResource(bytes) !== meta.mime || meta.kind !== (meta.mime.startsWith("font/") ? "font" : "image")) throw new Error("Resource metadata does not match its bytes.");
    if (meta.kind === "font" && bytes.length > MAX_FONT_BYTES) throw new Error("The font exceeds the 10 MB limit.");
    if (meta.kind === "image") {
      const result = validateImageBytes(bytes, bytes.length);
      if (!result.ok) throw new Error(result.reason);
      if ((meta.width !== undefined && meta.width !== result.info.width) || (meta.height !== undefined && meta.height !== result.info.height)) throw new Error("Image dimensions do not match metadata.");
    }
    return { meta, bytes };
  });
  const missing = referencedResources(bundle.doc).filter((id) => !seen.has(id));
  if (missing.length) throw new MissingResourcesError(missing);
  for (const l of bundle.doc.layers) {
    const id = l.type === "image" ? l.resourceId : l.type === "text" && !isBuiltinFont(l.font) ? l.font : null;
    if (id && resources.find((r) => r.meta.id === id)?.meta.kind !== (l.type === "image" ? "image" : "font")) throw new Error("Resource kind does not match its layer.");
  }
  return { doc: bundle.doc, resources };
}
export function rasterSize(width: number, height: number, scale: number): { width: number; height: number } {
  if (![width, height, scale].every((n) => Number.isFinite(n) && n > 0)) throw new Error("Raster dimensions and scale must be positive finite numbers.");
  const factor = Math.min(scale, 8192 / Math.max(width, height), Math.sqrt(40_000_000 / width / height));
  return { width: Math.max(1, Math.floor(width * factor)), height: Math.max(1, Math.floor(height * factor)) };
}
export async function rasterizeSvg(svg: string, width: number, height: number, scale: number, env: { createImage(): HTMLImageElement; createCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas }): Promise<Blob> {
  const size = rasterSize(width, height, scale);
  const image = env.createImage();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("The SVG could not be decoded.")); image.src = url; });
    const canvas = env.createCanvas(size.width, size.height);
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw new Error("A 2D canvas is unavailable.");
    context.drawImage(image, 0, 0, size.width, size.height);
    if ("convertToBlob" in canvas) return await canvas.convertToBlob({ type: "image/png" });
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed.")), "image/png"));
  } finally { image.onload = null; image.onerror = null; URL.revokeObjectURL(url); }
}
