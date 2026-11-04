import { z } from "zod";
import { BUILTIN_FONTS, BUILTIN_FONT_IDS, type BuiltinFontId } from "./fonts";

/**
 * The poster document: a fixed-size canvas with a flat stack of text, image and shape layers.
 *
 * - Coordinates are canvas pixels, origin top left. `layers[0]` is the bottom of the stack.
 * - A document only references fonts and images; it never contains a generated image. Image layers point at a
 *   resource the user added (IndexedDB) or are empty slots ("Add an image") that a template leaves for the user.
 * - The schema is versioned (`version`) and every stored or imported document is parsed with `DesignDocSchema`, so
 *   a later version can migrate older files instead of guessing.
 *
 * Environment-neutral: no DOM, no React. Shared by the editor, the renderer, export and the template pack.
 */

export const DESIGN_SCHEMA = "frameproof.design" as const;
export const DESIGN_VERSION = 1 as const;

/** Canvas limits. Large enough for print-ish posters, small enough to rasterise in a browser tab. */
export const CANVAS_MIN = 64;
export const CANVAS_MAX = 6000;
export const MAX_LAYERS = 200;
export const MAX_TEXT = 4000;
export const TEXT_SIZE_MAX = 1000;
export const STROKE_MAX = 500;

export const HexSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #C65A42")
  .transform((v) => v.toLowerCase());

/* ---------- fonts ---------- */

export { BUILTIN_FONTS, BUILTIN_FONT_IDS, type BuiltinFontId } from "./fonts";

export const FontRefSchema = z.union([z.enum(BUILTIN_FONT_IDS as [BuiltinFontId, ...BuiltinFontId[]]), z.string().regex(/^res_[\w-]{1,80}$/)]);
export type FontRef = z.infer<typeof FontRefSchema>;
export const isBuiltinFont = (f: FontRef): f is BuiltinFontId => Object.hasOwn(BUILTIN_FONTS, f);

/* ---------- layers ---------- */

const n = (min: number, max: number) => z.number().finite().min(min).max(max);

/**
 * What a layer is for in the composition. Optional; templates and items set it so the concept composer knows where
 * a brief's title, information lines and pictures go. It never affects rendering.
 */
export const LAYER_ROLES = ["title", "subtitle", "kicker", "info", "credit", "body", "number", "photo", "motif", "ground"] as const;
export type LayerRole = (typeof LAYER_ROLES)[number];

const LayerBase = {
  id: z.string().regex(/^[\w-]{1,64}$/),
  name: z.string().trim().min(1).max(80),
  role: z.enum(LAYER_ROLES).optional(),
  x: n(-CANVAS_MAX, CANVAS_MAX * 2),
  y: n(-CANVAS_MAX, CANVAS_MAX * 2),
  w: n(1, CANVAS_MAX * 2),
  h: n(1, CANVAS_MAX * 2),
  /** Degrees, clockwise, around the layer's centre. */
  rotation: n(-360, 360).default(0),
  opacity: n(0, 1).default(1),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
};

export const TextLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("text"),
  text: z.string().max(MAX_TEXT),
  font: FontRefSchema,
  size: n(4, TEXT_SIZE_MAX),
  weight: z.number().int().min(100).max(900).default(400),
  italic: z.boolean().default(false),
  /** Multiple of the font size. */
  lineHeight: n(0.6, 4).default(1.2),
  /** In em. */
  letterSpacing: n(-0.2, 1).default(0),
  align: z.enum(["left", "center", "right"]).default("left"),
  /** Top, middle or bottom of the box. */
  valign: z.enum(["top", "middle", "bottom"]).default("top"),
  color: HexSchema,
});

export const ImageLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("image"),
  /** A Resource id, or null for an empty slot the user fills. */
  resourceId: z.string().regex(/^res_[\w-]{1,80}$/).nullable(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** Corner radius in canvas px. */
  radius: n(0, CANVAS_MAX).default(0),
});

export const ShapeLayerSchema = z.object({
  ...LayerBase,
  type: z.literal("shape"),
  shape: z.enum(["rect", "ellipse", "line"]),
  fill: HexSchema.nullable(),
  stroke: HexSchema.nullable().default(null),
  strokeWidth: n(0, STROKE_MAX).default(0),
  radius: n(0, CANVAS_MAX).default(0),
});

export const LayerSchema = z.discriminatedUnion("type", [TextLayerSchema, ImageLayerSchema, ShapeLayerSchema]);

export type TextLayer = z.infer<typeof TextLayerSchema>;
export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type LayerType = Layer["type"];

/* ---------- document ---------- */

export const DesignDocSchema = z
  .object({
    schema: z.literal(DESIGN_SCHEMA),
    version: z.literal(DESIGN_VERSION),
    id: z.string().regex(/^[\w-]{1,80}$/),
    name: z.string().trim().min(1).max(120),
    width: z.number().int().min(CANVAS_MIN).max(CANVAS_MAX),
    height: z.number().int().min(CANVAS_MIN).max(CANVAS_MAX),
    background: HexSchema,
    layers: z.array(LayerSchema).max(MAX_LAYERS),
    /** Template the document started from, if any. */
    templateId: z.string().max(80).nullable().default(null),
    /** FrameProof project this design is reviewed in, if any (review bridge). */
    projectId: z.string().max(80).nullable().default(null),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
  })
  .superRefine((doc, ctx) => {
    const seen = new Set<string>();
    doc.layers.forEach((l, i) => {
      if (seen.has(l.id)) ctx.addIssue({ code: "custom", message: `Layer id "${l.id}" is used twice`, path: ["layers", i, "id"] });
      seen.add(l.id);
    });
  });

export type DesignDoc = z.infer<typeof DesignDocSchema>;
/** What a caller may pass in: defaults (rotation, opacity, …) can be left out. */
export type DesignDocInput = z.input<typeof DesignDocSchema>;
export type LayerInput = z.input<typeof LayerSchema>;

/** Resource ids a document points at (images and user fonts), for export bundles and "missing resource" checks. */
export function referencedResources(doc: DesignDoc): string[] {
  const ids = new Set<string>();
  for (const l of doc.layers) {
    if (l.type === "image" && l.resourceId) ids.add(l.resourceId);
    if (l.type === "text" && !isBuiltinFont(l.font)) ids.add(l.font);
  }
  return [...ids];
}

/* ---------- format presets ---------- */

export const FORMATS = [
  { id: "poster-a", label: "Poster 2:3", width: 1200, height: 1800 },
  { id: "portrait-4-5", label: "Social portrait 4:5", width: 1080, height: 1350 },
  { id: "square", label: "Square 1:1", width: 1080, height: 1080 },
  { id: "story", label: "Story 9:16", width: 1080, height: 1920 },
  { id: "landscape", label: "Landscape 16:9", width: 1920, height: 1080 },
] as const;

export function blankDoc(id: string, name: string, width: number, height: number, now = Date.now()): DesignDoc {
  return DesignDocSchema.parse({
    schema: DESIGN_SCHEMA,
    version: DESIGN_VERSION,
    id,
    name,
    width,
    height,
    background: "#f6f4ef",
    layers: [],
    createdAt: now,
    updatedAt: now,
  });
}
