import { z } from "zod";
import { CANVAS_MAX, CANVAS_MIN, EFFECT_BLUR_MAX, HexSchema, LayerSchema, MAX_LAYERS, STROKE_MAX, TEXT_SIZE_MAX, type DesignDoc, type Layer, DESIGN_SCHEMA, DESIGN_VERSION, DesignDocSchema } from "./schema";

/**
 * Starter templates and reusable items: both are layer stacks we wrote ourselves (MIT, like the app), set in the
 * built-in OFL fonts, made only of text, shapes and empty image slots. None contains a generated or downloaded
 * image; collage-style templates leave slots the user fills with their own pictures.
 *
 * - A template becomes a new document (`docFromTemplate`).
 * - An item is a small group of layers inserted into an open document (`insertItem`), scaled to fit and given
 *   fresh ids, like dragging a component from a library.
 *
 * Licence fields are required so a later third-party pack can't slip in without one.
 */

export const LicenceSchema = z.object({
  /** SPDX id or plain name, e.g. "MIT" or "OFL-1.1". */
  id: z.string().min(1).max(40),
  /** Who made it. */
  author: z.string().min(1).max(120),
  /** Where it came from: "FrameProof" for our own, otherwise a link to the original. */
  source: z.string().min(1).max(300),
});
export type Licence = z.infer<typeof LicenceSchema>;
export const OWN_LICENCE: Licence = { id: "MIT", author: "FrameProof contributors", source: "FrameProof" };

export const TEMPLATE_CONCEPTS = ["exhibition", "editorial-cover", "collage", "music", "type-as-image", "event"] as const;

export const TemplateSchema = z.object({
  id: z.string().regex(/^tpl_[\w-]{1,60}$/),
  name: z.string().min(1).max(80),
  concept: z.enum(TEMPLATE_CONCEPTS),
  /** One sentence on the idea the layout is built on (the principle, not a source artwork). */
  idea: z.string().min(1).max(300),
  width: z.number().int().min(CANVAS_MIN).max(CANVAS_MAX),
  height: z.number().int().min(CANVAS_MIN).max(CANVAS_MAX),
  background: HexSchema,
  layers: z.array(LayerSchema).min(1).max(MAX_LAYERS),
  licence: LicenceSchema,
});
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateInput = z.input<typeof TemplateSchema>;

export const ITEM_KINDS = ["type", "shape", "frame", "mark", "info"] as const;

export const ItemSchema = z.object({
  id: z.string().regex(/^item_[\w-]{1,60}$/),
  name: z.string().min(1).max(80),
  kind: z.enum(ITEM_KINDS),
  /** The item's own frame; its layers sit inside 0..width × 0..height. */
  width: z.number().positive().max(CANVAS_MAX),
  height: z.number().positive().max(CANVAS_MAX),
  layers: z.array(LayerSchema).min(1).max(40),
  licence: LicenceSchema,
  /** Search words (e.g. "swash", "light"). */
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});
export type Item = z.infer<typeof ItemSchema>;
export type ItemInput = z.input<typeof ItemSchema>;

export function docFromTemplate(t: Template, id: string, now = Date.now()): DesignDoc {
  return DesignDocSchema.parse({
    schema: DESIGN_SCHEMA,
    version: DESIGN_VERSION,
    id,
    name: t.name,
    width: t.width,
    height: t.height,
    background: t.background,
    layers: structuredClone(t.layers),
    templateId: t.id,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Layers for an item placed in `doc`: scaled so it fits within `fraction` of the canvas width (never enlarged past
 * its own size × 4), centred, with ids that don't collide with the document's.
 */
export function placeItem(item: Item, doc: DesignDoc, makeId: (prefix: string) => string, fraction = 0.5): Layer[] {
  // Scale to fit the frame, but never past what the schema allows for any scaled value (text size, stroke, radius,
  // box), so a valid item always produces valid layers instead of throwing on insert.
  const limit = (values: number[], max: number) => values.reduce((m, v) => (v > 0 ? Math.min(m, max / v) : m), Infinity);
  const scale = Math.min(
    4,
    (doc.width * fraction) / item.width,
    (doc.height * fraction) / item.height,
    limit(item.layers.flatMap((l) => (l.type === "text" ? [l.size] : [])), TEXT_SIZE_MAX),
    limit(item.layers.flatMap((l) => (l.type === "shape" ? [l.strokeWidth] : [])), STROKE_MAX),
    limit(item.layers.flatMap((l) => (l.type === "shape" || l.type === "image" ? [l.radius] : [])), CANVAS_MAX),
    limit(item.layers.flatMap((l) => (l.type === "effect" ? [l.blur] : [])), EFFECT_BLUR_MAX),
    limit(item.layers.flatMap((l) => [l.w, l.h]), CANVAS_MAX * 2),
  );
  const ox = (doc.width - item.width * scale) / 2;
  const oy = (doc.height - item.height * scale) / 2;
  const taken = new Set(doc.layers.map((l) => l.id));
  return item.layers.map((l) => {
    let id = makeId("l");
    while (taken.has(id)) id = makeId("l");
    taken.add(id);
    const placed = { ...structuredClone(l), id, x: ox + l.x * scale, y: oy + l.y * scale, w: l.w * scale, h: l.h * scale };
    if (placed.type === "text") placed.size = l.type === "text" ? l.size * scale : placed.size;
    if (placed.type === "shape") placed.strokeWidth *= scale;
    if (placed.type === "shape" || placed.type === "image") placed.radius *= scale;
    if (placed.type === "effect") placed.blur *= scale;
    return LayerSchema.parse(placed);
  });
}
