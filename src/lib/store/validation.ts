import { z } from "zod";
import { ReviewIssueSchema } from "../review/types";
import { DesignDocSchema } from "../design/schema";
import { ResourceMetaSchema } from "../design/resource";
import { REFERENCE_CATEGORIES, type Project, type StyleToken } from "./models";
const n = z.number().finite();
const time = n.nonnegative();
const size = z.object({ width: n.positive(), height: n.positive() });
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const strings = z.array(z.string());
const analysis = size.extend({
  bytes: time,
  kind: z.string(),
  aspect: z.object({ ratio: n.positive(), label: z.string(), exact: z.boolean() }),
  analysisSize: size,
  palette: z.object({ swatches: z.array(z.object({ hex, share: n, chroma: n, L: n })), transparentShare: n, method: z.string() }),
  frequency: z.array(z.object({ hex, share: n })),
  structure: z.object({
    meanLuma: n,
    lumaStdDev: n,
    edgeDensity: n,
    detailCentroid: z.object({ x: n, y: n }),
    quietShare: n,
    detailGrid: z.array(n).length(9),
    lumaHistogram: z.array(n).length(16),
  }),
});
const base = z.object({ id: z.string().min(1), createdAt: time });
const token = z.object({ name: z.string(), value: z.string(), note: z.string().optional() });
export const recordSchemas = {
  projects: base.extend({
    name: z.string(),
    brief: z.string(),
    referenceAssetId: z.string().nullable(),
    currentAssetId: z.string().nullable(),
    updatedAt: time,
    lastOpenedAt: time.optional(),
    sample: z.boolean().optional(),
  }),
  assets: base.extend({
    projectId: z.string().nullable(),
    name: z.string(),
    type: z.string(),
    bytes: time,
    width: n.positive(),
    height: n.positive(),
    blob: z.instanceof(Blob),
    thumb: z.instanceof(Blob),
    analysis,
    sample: z.boolean().optional(),
  }),
  references: base.extend({
    title: z.string(),
    url: z.string().refine((s) => !s || /^https?:\/\//i.test(s)),
    attribution: z.string(),
    assetId: z.string().nullable(),
    tags: strings,
    category: z.enum(REFERENCE_CATEGORIES),
    collection: z.string(),
    notes: z.string(),
    updatedAt: time,
  }),
  styles: base.extend({
    name: z.string(),
    palette: z.array(z.object({ name: z.string(), hex, share: n.optional(), origin: z.enum(["manual", "measured"]) })),
    typography: z.object({ display: z.string(), body: z.string(), mono: z.string(), notes: z.string() }),
    layoutPrinciples: strings,
    spacing: z.array(token),
    radius: z.array(token),
    motion: strings,
    referenceIds: strings,
    sourceAssetId: z.string().nullable(),
    notes: z.string(),
    updatedAt: time,
  }),
  reviews: base.extend({
    projectId: z.string(),
    version: n.int().positive(),
    referenceAssetId: z.string(),
    currentAssetId: z.string(),
    measurements: z.object({
      reference: analysis,
      current: analysis,
      comparison: z.object({
        canvas: size.extend({ note: z.string() }),
        ssim: n,
        dHashDistance: n,
        histogramIntersection: n,
        changedShare: n,
        aspectDifference: n,
      }),
    }),
    issues: z.array(ReviewIssueSchema),
    notes: z.string(),
    ai: z.discriminatedUnion("state", [
      z.object({ state: z.literal("skipped") }),
      z.object({ state: z.literal("not-configured") }),
      z.object({ state: z.literal("ok"), provider: z.string(), model: z.string(), summary: z.string() }),
      z.object({ state: z.literal("failed"), provider: z.string(), message: z.string() }),
    ]),
  }),
  designs: DesignDocSchema,
  resources: ResourceMetaSchema.extend({ blob: z.instanceof(Blob) }),
};
export function validateRecords<K extends keyof typeof recordSchemas>(store: K, records: unknown[]) {
  const valid: z.infer<(typeof recordSchemas)[K]>[] = [];
  // Keep the stored object, not Zod's parsed copy: parsing strips keys the schema doesn't list, and records are
  // written back after edits, so returning the copy would silently delete fields.
  for (const record of records) if (recordSchemas[store].safeParse(record).success) valid.push(record as z.infer<(typeof recordSchemas)[K]>);
  return { records: valid, skipped: records.length - valid.length };
}
export function sortRecentProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt));
}
export function textToTokens(text: string): StyleToken[] {
  const tokens: StyleToken[] = [];
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    const match = /^\s*([\w-]+)\s*:\s*([-\w.%() ]+)\s*$/.exec(line);
    if (!match || !match[2]!.trim()) throw new Error(`Line ${i + 1}: use name: value, with letters, numbers, %, dots, parentheses or dashes.`);
    tokens.push({ name: match[1]!, value: match[2]!.trim() });
  });
  return tokens;
}
