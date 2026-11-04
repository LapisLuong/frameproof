import { isBuiltinArt } from "./art";
import type { ResourceMeta } from "./resource";
import { DesignDocSchema, isBuiltinFont, type DesignDoc } from "./schema";

/**
 * Importing a design file never overwrites anything already in this browser. Each picture or font in the file gets a
 * fresh id (or, when the library already holds the very same bytes, that existing resource is reused), and every
 * reference in the document is rewritten to match. Built-in artworks keep their ids: they ship with the app.
 */

export type IncomingResource = { meta: ResourceMeta; bytes: Uint8Array };
export type ImportPlan = { doc: DesignDoc; store: IncomingResource[]; reused: number };

/** Rewrite image and font references through `map` (old id → new id); ids not in the map are left as they are. */
export function remapDoc(doc: DesignDoc, map: ReadonlyMap<string, string>): DesignDoc {
  const layers = doc.layers.map((l) => {
    if (l.type === "image" && l.resourceId && map.has(l.resourceId)) return { ...l, resourceId: map.get(l.resourceId)! };
    if (l.type === "text" && !isBuiltinFont(l.font) && map.has(l.font)) return { ...l, font: map.get(l.font)! };
    return l;
  });
  return DesignDocSchema.parse({ ...doc, layers });
}

export async function planImport(
  doc: DesignDoc,
  resources: IncomingResource[],
  opts: { freshId: () => string; docId: string; now: number; existingSame: (r: IncomingResource) => Promise<string | null> },
): Promise<ImportPlan> {
  const map = new Map<string, string>();
  const store: IncomingResource[] = [];
  let reused = 0;
  for (const r of resources) {
    if (isBuiltinArt(r.meta.id)) continue;
    const same = await opts.existingSame(r);
    if (same) {
      map.set(r.meta.id, same);
      reused++;
      continue;
    }
    const id = opts.freshId();
    map.set(r.meta.id, id);
    store.push({ meta: { ...r.meta, id, createdAt: opts.now, updatedAt: opts.now }, bytes: r.bytes });
  }
  return { doc: remapDoc({ ...doc, id: opts.docId, projectId: null, updatedAt: opts.now }, map), store, reused };
}
