import { z } from "zod";
import { LicenceSchema } from "./library";

/**
 * A user resource: an image or font file the user added to their library for use in designs. Stored in IndexedDB
 * (store "resources"), never uploaded. Licence fields are what the user tells us; FrameProof records them and shows
 * them on export, it doesn't verify them. Links (Figma, Canva, websites) stay in the Library as links: a link is
 * never turned into a resource or an editable document.
 */
export const RESOURCE_KINDS = ["image", "font"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const FONT_MIMES = ["font/ttf", "font/otf", "font/woff", "font/woff2"] as const;
export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
export const MAX_FONT_BYTES = 10 * 1024 * 1024;

export const ResourceMetaSchema = z.object({
  id: z.string().regex(/^res_[\w-]{1,80}$/),
  kind: z.enum(RESOURCE_KINDS),
  name: z.string().trim().min(1).max(200),
  /** Sniffed from the bytes, never the browser-declared type. */
  mime: z.enum([...FONT_MIMES, ...IMAGE_MIMES]),
  bytes: z.number().int().positive(),
  /** Pixel size, images only. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  licence: LicenceSchema,
  tags: z.array(z.string().max(40)).max(20).default([]),
  /** Made in FrameProof from another picture (a cut-out, a filled area); the source is kept unchanged. */
  derivedFrom: z
    .object({ resourceId: z.string().max(80), tool: z.enum(["cutout", "inpaint"]), model: z.string().max(80) })
    .optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type ResourceMeta = z.infer<typeof ResourceMetaSchema>;
export type Resource = ResourceMeta & { blob: Blob };
