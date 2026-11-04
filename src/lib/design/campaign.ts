import { layoutText, type Measure } from "./layout";
import { CANVAS_MAX, DesignDocSchema, EFFECT_BLUR_MAX, LayerSchema, STROKE_MAX, TEXT_SIZE_MAX, type DesignDoc, type Layer } from "./schema";

/**
 * Campaign formats: the same design recomposed for another shape (square post, story, banner, standee, avatar).
 * Deterministic rules on the layers, never a stretched picture: fonts, colours, words, pictures and the logo are
 * kept exactly; only position and scale change. Each result is a new, independent document that remembers its source.
 *
 * Strategies, so a batch can offer real alternatives:
 * - "anchor": every layer keeps the edge or centre it was aligned to; sizes scale uniformly. Best for nearby shapes.
 * - "split": pictures (and motifs) in one zone, type in the other, each group scaled as a block, for shapes that
 *   differ a lot (portrait → banner, landscape → story). "split-mirrored" swaps the zones.
 */

export type CampaignFormat = {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Printed size, when the format is for print. */
  physical?: { widthCm: number; heightCm: number };
  /** Circle-safe area for avatars (fraction of the short side). */
  circleSafe?: number;
  /** Bands a platform covers with its own buttons and captions (fractions of the height). Approximate. */
  overlay?: { top: number; bottom: number };
};

export const CAMPAIGN_FORMATS: CampaignFormat[] = [
  { id: "square", label: "Square post 1:1", width: 1080, height: 1080 },
  { id: "portrait-4-5", label: "Portrait post 4:5", width: 1080, height: 1350 },
  { id: "story", label: "Story 9:16", width: 1080, height: 1920, overlay: { top: 0.13, bottom: 0.18 } },
  { id: "banner", label: "Banner 3:1", width: 1500, height: 500 },
  { id: "cover", label: "Page cover 2.7:1", width: 1640, height: 624 },
  { id: "standee-80x180", label: "Standee 80 × 180 cm", width: 2667, height: 6000, physical: { widthCm: 80, heightCm: 180 } },
  { id: "avatar", label: "Avatar 1:1 (circle-safe)", width: 1080, height: 1080, circleSafe: 0.82 },
];

/** Print resolution a raster of this size gives at the format's physical size (it doesn't change the file). */
export function printDpi(f: CampaignFormat): number | null {
  if (!f.physical) return null;
  return Math.round(Math.min(f.width / (f.physical.widthCm / 2.54), f.height / (f.physical.heightCm / 2.54)));
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * Where content goes: the whole canvas, the square inside an avatar's circle, or the story area between the
 * platform's top and bottom bands. Full-bleed layers still cover the whole canvas.
 */
export function safeBox(f: CampaignFormat): Box {
  const { width: W, height: H } = f;
  if (f.circleSafe) {
    const side = (Math.min(W, H) * f.circleSafe) / Math.SQRT2;
    return { x: (W - side) / 2, y: (H - side) / 2, w: side, h: side };
  }
  if (f.overlay) return { x: 0, y: H * f.overlay.top, w: W, h: H * (1 - f.overlay.top - f.overlay.bottom) };
  return { x: 0, y: 0, w: W, h: H };
}

export type Strategy = "anchor" | "split" | "split-mirrored";
export type Recomposed = { doc: DesignDoc; strategy: Strategy; notes: string[] };

const area = (b: Box) => Math.max(0, b.w) * Math.max(0, b.h);
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

/** Covers (nearly) the whole canvas: a ground, a full-bleed picture, grain or a vignette. Refilled, not moved. */
export function isFullBleed(l: Layer, doc: { width: number; height: number }): boolean {
  if (l.rotation) return false;
  return l.w >= doc.width * 0.85 && l.h >= doc.height * 0.85 && l.x <= doc.width * 0.08 && l.y <= doc.height * 0.08;
}

const BOX_MAX = CANVAS_MAX * 2;
const clampPos = (v: number) => Math.min(BOX_MAX, Math.max(-CANVAS_MAX, v));

/**
 * Scale every size property of a layer (box, text size, strokes, radius, blur) by s; position set separately.
 * Each value stays inside the schema's limits so a valid design always gives a valid variant; when a limit
 * changes a value, the layer's name goes into `capped` so the variant says so instead of failing.
 */
function scaleLayer(l: Layer, s0: number, x: number, y: number, capped: Set<string>): Layer {
  // The box keeps its proportions: one scale for both sides, reduced if either side would pass the limit.
  const s = Math.min(s0, BOX_MAX / l.w, BOX_MAX / l.h);
  let cut = s < s0;
  const cap = (v: number, max: number) => {
    if (v > max) cut = true;
    return Math.min(max, v);
  };
  const base = { ...l, x: clampPos(x), y: clampPos(y), w: Math.max(1, l.w * s), h: Math.max(1, l.h * s) };
  if (base.type === "text") base.size = Math.max(4, cap(base.size * s, TEXT_SIZE_MAX));
  if (base.type === "shape") {
    base.strokeWidth = cap(base.strokeWidth * s, STROKE_MAX);
    base.radius = cap(base.radius * s, CANVAS_MAX);
  }
  if (base.type === "image") base.radius = cap(base.radius * s, CANVAS_MAX);
  if (base.type === "effect") base.blur = cap(base.blur * s, EFFECT_BLUR_MAX);
  if (cut) capped.add(l.name);
  return LayerSchema.parse(base);
}

function refill(l: Layer, W: number, H: number): Layer {
  return LayerSchema.parse({ ...l, x: 0, y: 0, w: W, h: H });
}

/** Which edge (or the centre) a layer is aligned to on one axis, judged by the nearest of the three. */
function anchorOf(start: number, size: number, total: number): "start" | "centre" | "end" {
  const toStart = start;
  const toEnd = total - (start + size);
  const toCentre = Math.abs(start + size / 2 - total / 2);
  if (toCentre <= Math.min(toStart, toEnd)) return "centre";
  return toStart <= toEnd ? "start" : "end";
}

function place(start: number, size: number, total: number, newTotal: number, s: number): number {
  const a = anchorOf(start, size, total);
  if (a === "start") return start * s;
  if (a === "end") return newTotal - (total - start - size) * s - size * s;
  return ((start + size / 2) / total) * newTotal - (size * s) / 2;
}

function anchorRecompose(doc: DesignDoc, b: Box, W: number, H: number, capped: Set<string>): Layer[] {
  const s = Math.min(b.w / doc.width, b.h / doc.height);
  return doc.layers.map((l) =>
    isFullBleed(l, doc) ? refill(l, W, H) : scaleLayer(l, s, b.x + place(l.x, l.w, doc.width, b.w, s), b.y + place(l.y, l.h, doc.height, b.h, s), capped),
  );
}

/** Group fit: scale a set of layers as one block into a zone, centred, keeping their arrangement. */
function fitGroup(layers: Layer[], zone: Box, capped: Set<string>): Map<string, Layer> {
  const out = new Map<string, Layer>();
  const b = union(layers);
  if (!b) return out;
  const s = Math.min(zone.w / b.w, zone.h / b.h);
  const ox = zone.x + (zone.w - b.w * s) / 2;
  const oy = zone.y + (zone.h - b.h * s) / 2;
  for (const l of layers) out.set(l.id, scaleLayer(l, s, ox + (l.x - b.x) * s, oy + (l.y - b.y) * s, capped));
  return out;
}

function splitRecompose(doc: DesignDoc, box: Box, W: number, H: number, mirrored: boolean, capped: Set<string>): Layer[] | null {
  const content = doc.layers.filter((l) => !l.hidden && !isFullBleed(l, doc));
  const texts = content.filter((l) => l.type === "text");
  // A shape mostly behind a text block (an info strip, a label box) travels with that text.
  const backing = new Set(
    content.filter((l) => l.type !== "text" && !(l.type === "image" && l.role === "photo") && texts.some((t) => overlap(t, l) >= area(t) * 0.7)).map((l) => l.id),
  );
  const isPicture = (l: Layer) => (l.type === "image" && l.role !== "motif") || ((l.type === "shape" || l.type === "effect") && !backing.has(l.id));
  let hero = content.filter((l) => l.type !== "text" && isPicture(l));
  let type = content.filter((l) => !hero.includes(l));
  if (!hero.some((l) => l.type === "image")) {
    // No pictures: the big type (title, number, motif words) is the hero; information goes in the other zone.
    const big = (l: Layer) => l.type === "text" && (l.role === "title" || l.role === "number" || l.role === "motif");
    hero = content.filter((l) => big(l) || (l.type !== "text" && !backing.has(l.id)));
    type = content.filter((l) => !hero.includes(l));
  }
  if (!hero.length || !type.length) return null;
  const { x: X, y: Y, w: BW, h: BH } = box;
  const wide = BW / BH >= doc.width / doc.height;
  const m = Math.min(BW, BH) * 0.06;
  const zones: [Box, Box] = wide
    ? [
        { x: X + m, y: Y + m, w: BW * 0.46 - m * 1.5, h: BH - 2 * m },
        { x: X + BW * 0.46 + m * 0.5, y: Y + m, w: BW * 0.54 - m * 1.5, h: BH - 2 * m },
      ]
    : [
        { x: X + m, y: Y + m, w: BW - 2 * m, h: BH * 0.56 - m * 1.5 },
        { x: X + m, y: Y + BH * 0.56 + m * 0.5, w: BW - 2 * m, h: BH * 0.44 - m * 1.5 },
      ];
  const [za, zb] = mirrored ? [zones[1], zones[0]] : zones;
  const placed = new Map([...fitGroup(hero, za, capped), ...fitGroup(type, zb, capped)]);
  return doc.layers.map((l) => (isFullBleed(l, doc) ? refill(l, W, H) : (placed.get(l.id) ?? l)));
}

const ratio = (w: number, h: number) => w / h;

/** The strategies worth offering for this change of shape, best first. */
export function strategiesFor(doc: { width: number; height: number }, f: { width: number; height: number }): Strategy[] {
  const r = ratio(f.width, f.height) / ratio(doc.width, doc.height);
  const far = r > 1.7 || r < 0.6;
  return far ? ["split", "split-mirrored", "anchor"] : ["anchor", "split", "split-mirrored"];
}

export function recompose(doc: DesignDoc, f: CampaignFormat, strategy: Strategy, ids: { id: string; now: number }, measure: Measure): Recomposed | null {
  const { width: W, height: H } = f;
  const box = safeBox(f);
  const capped = new Set<string>();
  const layers = strategy === "anchor" ? anchorRecompose(doc, box, W, H, capped) : splitRecompose(doc, box, W, H, strategy === "split-mirrored", capped);
  if (!layers) return null;
  const next = DesignDocSchema.parse({
    ...doc,
    id: ids.id,
    name: `${doc.name} — ${f.label}`.slice(0, 120),
    width: W,
    height: H,
    layers,
    projectId: null,
    sourceDesignId: doc.id,
    createdAt: ids.now,
    updatedAt: ids.now,
  });
  const notes = [
    strategy === "anchor"
      ? "Recomposed by rule: each layer keeps the edge or centre it was aligned to; sizes scaled evenly."
      : `Recomposed by rule: pictures in one zone, type in the ${strategy === "split" ? "other" : "other, sides swapped"}; each group scaled as a block.`,
    "Fonts, colours, words, pictures and logo are unchanged.",
  ];
  const overflow = next.layers.filter((l) => l.type === "text" && !l.hidden && layoutText(l, measure).overflows).map((l) => l.name);
  if (overflow.length) notes.push(`${overflow.join(", ")}: text runs past its box at this size; check it in the editor.`);
  if (f.circleSafe) notes.push("Content is kept inside the circle a round profile picture shows; the background fills the corners.");
  if (f.overlay) notes.push("Content is kept clear of the top and bottom bands where the platform shows its own buttons (approximate).");
  if (capped.size) notes.push(`${[...capped].join(", ")}: a size reached the editor's limit and was capped; check it in the editor.`);
  // Below about 1.6% of the short side, type is hard to read where these formats are seen (feeds, banners, print from afar).
  const tiny = next.layers.filter((l) => l.type === "text" && !l.hidden && l.size < Math.min(W, H) * 0.016).map((l) => l.name);
  if (tiny.length) notes.push(`${tiny.join(", ")}: very small at this format; consider enlarging.`);
  if (f.circleSafe) {
    const r = (Math.min(W, H) * f.circleSafe) / 2;
    const outside = next.layers.filter((l) => l.type === "text" && !l.hidden && corners(l).some(([x, y]) => Math.hypot(x - W / 2, y - H / 2) > r)).map((l) => l.name);
    if (outside.length) notes.push(`${outside.join(", ")}: outside the circle a round avatar shows; it will be cropped.`);
  }
  const dpi = printDpi(f);
  if (dpi !== null && f.physical)
    notes.push(`At ${f.physical.widthCm} × ${f.physical.heightCm} cm this ${W} × ${H} px canvas prints at about ${dpi} DPI. For sharper print, export SVG (vector type and shapes; pictures keep their own resolution).`);
  return { doc: next, strategy, notes };
}

/** The layer's corners as drawn: rotated about the box centre, as the renderer does. */
export function corners(l: Layer): Array<[number, number]> {
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const a = ((l.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return (
    [
      [-l.w / 2, -l.h / 2],
      [l.w / 2, -l.h / 2],
      [-l.w / 2, l.h / 2],
      [l.w / 2, l.h / 2],
    ] as Array<[number, number]>
  ).map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
}

/** Up to `count` distinct recompositions for one format (a batch to choose from). */
export function campaignVariants(doc: DesignDoc, f: CampaignFormat, newId: () => string, now: number, measure: Measure, count = 2): Recomposed[] {
  const out: Recomposed[] = [];
  for (const s of strategiesFor(doc, f)) {
    if (out.length >= count) break;
    const r = recompose(doc, f, s, { id: newId(), now }, measure);
    if (r) out.push(r);
  }
  return out;
}
