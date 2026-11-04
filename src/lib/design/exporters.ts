"use client";

import { withBase } from "../base-path";
import { measureText } from "./browser";
import { createBundle, exportSvg, MissingResourcesError, rasterizeSvg, type ExportDeps } from "./export";
import { referencedResources, type DesignDoc } from "./schema";
import { artLicence, getBuiltinArt, type BuiltinArt } from "./art";
import type { Resource } from "./resource";

/**
 * Browser glue between the editor and export.ts: where font files and resources come from, and how a raster is made.
 * Exports always render without placeholders and refuse when a picture or font the design uses is missing.
 */

const fontCache = new Map<string, Promise<Uint8Array>>();
function loadBuiltinFont(file: string): Promise<Uint8Array> {
  let p = fontCache.get(file);
  if (!p) {
    p = fetch(withBase(`/fonts/${file}`)).then(async (r) => {
      if (!r.ok) throw new Error(`The font file ${file} couldn't be loaded for export.`);
      return new Uint8Array(await r.arrayBuffer());
    });
    p.catch(() => fontCache.delete(file));
    fontCache.set(file, p);
  }
  return p;
}

export const artUrl = (a: BuiltinArt) => withBase(`/art/${a.file}`);

async function artResource(a: BuiltinArt): Promise<Resource> {
  const res = await fetch(artUrl(a));
  if (!res.ok) throw new Error(`The artwork “${a.name}” couldn't be loaded for export.`);
  const blob = new Blob([await res.arrayBuffer()], { type: "image/jpeg" });
  return { id: a.id, kind: "image", name: a.name, mime: "image/jpeg", bytes: blob.size, width: a.width, height: a.height, licence: artLicence(a), tags: ["public domain"], createdAt: 0, updatedAt: 0, blob };
}

function deps(resources: Resource[]): ExportDeps {
  const byId = new Map(resources.map((r) => [r.id, r]));
  return {
    measure: measureText,
    loadBuiltinFont,
    loadResource: async (id) => {
      const art = getBuiltinArt(id);
      const r = art ? await artResource(art) : byId.get(id);
      return r ? { mime: r.mime, bytes: new Uint8Array(await r.blob.arrayBuffer()) } : null;
    },
  };
}

export function missingMessage(e: unknown, resources: Resource[]): string {
  if (e instanceof MissingResourcesError) {
    const n = e.ids.length;
    return `${n === 1 ? "One picture or font this design uses is" : `${n} pictures or fonts this design uses are`} missing from your library, so it can't be exported. Replace or remove ${n === 1 ? "it" : "them"} first.`;
  }
  void resources;
  return e instanceof Error ? e.message : "The export failed. Try again.";
}

export async function designSvg(doc: DesignDoc, resources: Resource[]): Promise<string> {
  return exportSvg(doc, deps(resources));
}

export async function designPng(doc: DesignDoc, resources: Resource[], scale = 1): Promise<Blob> {
  const svg = await designSvg(doc, resources);
  return rasterizeSvg(svg, doc.width, doc.height, scale, {
    createImage: () => new Image(),
    createCanvas: (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }),
  });
}

export async function designBundle(doc: DesignDoc, resources: Resource[]): Promise<string> {
  const used = referencedResources(doc);
  // Built-in artworks travel inside the file too, so it opens anywhere, with their CC0 licence and source.
  const art = await Promise.all(used.flatMap((id) => (getBuiltinArt(id) ? [artResource(getBuiltinArt(id)!)] : [])));
  return createBundle(doc, [...resources.filter((r) => used.includes(r.id)), ...art]);
}
