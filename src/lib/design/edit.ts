import { LayerSchema, MAX_LAYERS, type DesignDoc, type Layer, type LayerInput } from "./schema";

/**
 * Pure document edits used by the editor. Each returns a new document (or the same one when nothing changes),
 * which keeps undo snapshots cheap and makes every operation testable without a DOM.
 */

const touch = (doc: DesignDoc, layers: Layer[]): DesignDoc => ({ ...doc, layers });

export function updateLayer(doc: DesignDoc, id: string, patch: Partial<Layer>): DesignDoc {
  let changed = false;
  const layers = doc.layers.map((l) => {
    if (l.id !== id) return l;
    const next = { ...l, ...patch, id: l.id, type: l.type } as Layer;
    const parsed = LayerSchema.safeParse(next);
    if (!parsed.success) return l;
    changed = true;
    return parsed.data;
  });
  return changed ? touch(doc, layers) : doc;
}

export function addLayer(doc: DesignDoc, input: LayerInput | LayerInput[]): { doc: DesignDoc; ids: string[] } {
  const items = (Array.isArray(input) ? input : [input]).map((l) => LayerSchema.parse(l));
  if (doc.layers.length + items.length > MAX_LAYERS) throw new Error(`A design can hold ${MAX_LAYERS} layers. Delete some first.`);
  return { doc: touch(doc, [...doc.layers, ...items]), ids: items.map((l) => l.id) };
}

export function removeLayer(doc: DesignDoc, id: string): DesignDoc {
  const layers = doc.layers.filter((l) => l.id !== id);
  return layers.length === doc.layers.length ? doc : touch(doc, layers);
}

export function duplicateLayer(doc: DesignDoc, id: string, newId: string, offset = 24): { doc: DesignDoc; id: string | null } {
  const i = doc.layers.findIndex((l) => l.id === id);
  const src = doc.layers[i];
  if (!src || doc.layers.length >= MAX_LAYERS) return { doc, id: null };
  const copy = LayerSchema.parse({ ...structuredClone(src), id: newId, name: `${src.name} copy`.slice(0, 80), x: src.x + offset, y: src.y + offset, locked: false });
  const layers = [...doc.layers];
  layers.splice(i + 1, 0, copy);
  return { doc: touch(doc, layers), id: newId };
}

export type StackMove = "forward" | "backward" | "front" | "back";

/** Reorder in the stack. "forward" moves one step toward the top (drawn later). */
export function moveLayer(doc: DesignDoc, id: string, move: StackMove): DesignDoc {
  const i = doc.layers.findIndex((l) => l.id === id);
  if (i < 0) return doc;
  const last = doc.layers.length - 1;
  const target = move === "front" ? last : move === "back" ? 0 : move === "forward" ? Math.min(last, i + 1) : Math.max(0, i - 1);
  if (target === i) return doc;
  const layers = [...doc.layers];
  const [layer] = layers.splice(i, 1);
  layers.splice(target, 0, layer!);
  return touch(doc, layers);
}

/** Point inside a layer's box, allowing for its rotation around the centre. */
export function containsPoint(l: Layer, x: number, y: number, slop = 0): boolean {
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const a = (-l.rotation * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(rx) <= l.w / 2 + slop && Math.abs(ry) <= l.h / 2 + slop;
}

/** Topmost visible layer under a canvas point. Locked layers are skipped unless asked for. */
export function hitTest(doc: DesignDoc, x: number, y: number, opts: { includeLocked?: boolean; slop?: number } = {}): Layer | null {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i]!;
    if (l.hidden || (l.locked && !opts.includeLocked)) continue;
    if (containsPoint(l, x, y, opts.slop ?? 0)) return l;
  }
  return null;
}

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/**
 * Resize from a handle by a drag of (dx, dy) in canvas px, measured in the layer's own (unrotated) axes.
 * `keepRatio` holds the aspect ratio (corner handles). The opposite edge stays put; size never drops below 1 px.
 */
export function resizeBox(box: { x: number; y: number; w: number; h: number }, handle: Handle, dx: number, dy: number, keepRatio = false) {
  let { x, y, w, h } = box;
  const ratio = box.w / box.h;
  if (handle.includes("e")) w = box.w + dx;
  if (handle.includes("w")) w = box.w - dx;
  if (handle.includes("s")) h = box.h + dy;
  if (handle.includes("n")) h = box.h - dy;
  w = Math.max(1, w);
  h = Math.max(1, h);
  if (keepRatio && handle.length === 2) {
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }
  if (handle.includes("w")) x = box.x + box.w - w;
  if (handle.includes("n")) y = box.y + box.h - h;
  return { x, y, w, h };
}

/** Sensible starting layers for the "Add" buttons, centred on the canvas. */
export function starterLayer(doc: DesignDoc, kind: "text" | "rect" | "ellipse" | "line" | "image", id: string): LayerInput {
  const w = Math.round(doc.width * 0.6);
  const h = kind === "line" ? Math.max(4, Math.round(doc.width / 200)) : kind === "text" ? Math.round(doc.width * 0.12) : Math.round(doc.width * 0.4);
  const base = { id, x: Math.round((doc.width - w) / 2), y: Math.round((doc.height - h) / 2), w, h };
  switch (kind) {
    case "text":
      return { ...base, type: "text", name: "Text", text: "Tiêu đề mới", font: "be-vietnam-pro", size: Math.round(doc.width * 0.07), weight: 600, color: "#202323" };
    case "image":
      return { ...base, type: "image", name: "Image slot", resourceId: null };
    case "line":
      return { ...base, type: "shape", name: "Rule", shape: "line", fill: "#202323" };
    default:
      return { ...base, type: "shape", name: kind === "rect" ? "Rectangle" : "Ellipse", shape: kind, fill: "#c65a42" };
  }
}

/**
 * Resize a possibly rotated layer from a handle. `resizeBox` works in the layer's own axes; because rotation is
 * around the centre, changing the size moves the centre, so the box is translated to keep the point opposite the
 * handle (an edge midpoint or corner) where it was on the canvas.
 */
export function resizeRotated(box: { x: number; y: number; w: number; h: number; rotation: number }, handle: Handle, dx: number, dy: number, keepRatio = false) {
  const next = resizeBox(box, handle, dx, dy, keepRatio);
  if (!box.rotation) return next;
  const sx = handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0;
  const sy = handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0;
  // Anchor relative to the centre, in local axes, before and after.
  const a0 = { x: (-sx * box.w) / 2, y: (-sy * box.h) / 2 };
  const a1 = { x: (-sx * next.w) / 2, y: (-sy * next.h) / 2 };
  const t = (box.rotation * Math.PI) / 180;
  const ddx = a0.x - a1.x;
  const ddy = a0.y - a1.y;
  const cx = box.x + box.w / 2 + ddx * Math.cos(t) - ddy * Math.sin(t);
  const cy = box.y + box.h / 2 + ddx * Math.sin(t) + ddy * Math.cos(t);
  return { x: cx - next.w / 2, y: cy - next.h / 2, w: next.w, h: next.h };
}
