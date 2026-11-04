"use client";

import { compareBuffers, stripDiff } from "../analysis/analyze";
import { decodeAndAnalyze, pixelsFromBlob } from "../image/decode";
import { buildLocalIssues } from "../review/engine";
import { sortIssues, type ReviewIssue } from "../review/types";
import { getAll, getByProject, getOne, newId, put, putAll, remove, type StoreName } from "./db";
import type { AiStatus, Asset, InspirationRef, Project, Review, StyleSystem } from "./models";
import { recordSchemas, validateRecords, sortRecentProjects } from "./validation";
import { toast } from "@/components/Toast";
import { withBase } from "../base-path";
import { blankDoc, DesignDocSchema, referencedResources, type DesignDoc } from "../design/schema";
import { docFromTemplate, type Licence, type Template } from "../design/library";
import { MAX_FONT_BYTES, ResourceMetaSchema, type Resource, type ResourceKind, type ResourceMeta } from "../design/resource";
import { validateFontFile } from "../design/resource-validate";
import { planImport, type IncomingResource } from "../design/import-plan";
import { MIME_BY_KIND, validateImageFile } from "../image/validate";

/* ---------- change notifications (so open views refresh after a save) ---------- */

type Listener = (store: StoreName) => void;
const listeners = new Set<Listener>();
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(store: StoreName) {
  for (const fn of listeners) fn(store);
}

/** Say once per session that a store holds records that can't be read, instead of on every reload. */
const reported = new Set<string>();
function reportSkipped(store: StoreName, count: number) {
  if (!count || reported.has(store)) return;
  reported.add(store);
  toast(
    count === 1
      ? `1 saved ${store.replace(/s$/, "")} couldn't be read and was skipped. It stays in this browser's storage.`
      : `${count} saved ${store} couldn't be read and were skipped. They stay in this browser's storage.`,
  );
}

async function readAll<T>(store: StoreName, projectId?: string): Promise<T[]> {
  const raw = projectId && (store === "assets" || store === "reviews") ? await getByProject<unknown>(store, projectId) : await getAll<unknown>(store);
  const result = validateRecords(store, raw);
  reportSkipped(store, result.skipped);
  return result.records as T[];
}
async function readOne<T>(store: StoreName, id: string): Promise<T | undefined> {
  const raw = await getOne<unknown>(store, id);
  if (raw === undefined) return undefined;
  const result = recordSchemas[store].safeParse(raw);
  if (!result.success) {
    reportSkipped(store, 1);
    return undefined;
  }
  return raw as T;
}

/* ---------- assets ---------- */

export async function saveAsset(file: Blob, name: string, projectId: string | null, opts: { sample?: boolean } = {}): Promise<Asset> {
  const d = await decodeAndAnalyze(file);
  const asset: Asset = {
    id: newId("img"),
    projectId,
    name: name.slice(0, 200) || "Untitled image",
    type: d.mime,
    bytes: file.size,
    width: d.info.width,
    height: d.info.height,
    // Store under the sniffed type so the blob is never served as something else.
    blob: new Blob([file], { type: d.mime }),
    thumb: d.thumb,
    analysis: d.analysis,
    createdAt: Date.now(),
    ...(opts.sample ? { sample: true } : {}),
  };
  await put("assets", asset);
  emit("assets");
  return asset;
}

export const getAsset = (id: string) => readOne<Asset>("assets", id);
export const listAssets = () => readAll<Asset>("assets");

/* ---------- projects ---------- */

export async function listProjects(): Promise<Project[]> {
  return sortRecentProjects(await readAll<Project>("projects"));
}

export const getProject = (id: string) => readOne<Project>("projects", id);

export async function createProject(name: string, brief = "", opts: { sample?: boolean } = {}): Promise<Project> {
  const now = Date.now();
  const p: Project = {
    id: newId("prj"),
    name: name.trim().slice(0, 120) || "Untitled project",
    brief: brief.slice(0, 2000),
    referenceAssetId: null,
    currentAssetId: null,
    createdAt: now,
    updatedAt: now,
    ...(opts.sample ? { sample: true } : {}),
  };
  await put("projects", p);
  emit("projects");
  return p;
}

export async function updateProject(id: string, patch: Partial<Pick<Project, "name" | "brief" | "referenceAssetId" | "currentAssetId">>): Promise<Project> {
  const p = await getProject(id);
  if (!p) throw new Error("This project no longer exists.");
  const next: Project = { ...p, ...patch, updatedAt: Date.now() };
  await put("projects", next);
  emit("projects");
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  const [assets, reviews] = await Promise.all([readAll<Asset>("assets", id), readAll<Review>("reviews", id)]);
  await remove(
    "reviews",
    reviews.map((r) => r.id),
  );
  await remove(
    "assets",
    assets.map((a) => a.id),
  );
  await remove("projects", [id]);
  emit("projects");
}

/** Attach an uploaded image as the project's reference or current design. Earlier images are kept for review history. */
export async function setProjectImage(projectId: string, role: "reference" | "current", file: Blob, name: string): Promise<Asset> {
  const asset = await saveAsset(file, name, projectId);
  await updateProject(projectId, role === "reference" ? { referenceAssetId: asset.id } : { currentAssetId: asset.id });
  return asset;
}

/* ---------- reviews ---------- */

export async function listReviews(projectId: string): Promise<Review[]> {
  return (await readAll<Review>("reviews", projectId)).sort((a, b) => b.version - a.version);
}

export async function listAllReviews(): Promise<Review[]> {
  return (await readAll<Review>("reviews")).sort((a, b) => b.createdAt - a.createdAt);
}

export const getReview = (id: string) => readOne<Review>("reviews", id);

/** Run the local (deterministic) review for the project's current image pair and save it as a new version. */
export async function runLocalReview(projectId: string): Promise<Review> {
  const project = await getProject(projectId);
  if (!project) throw new Error("This project no longer exists.");
  if (!project.referenceAssetId || !project.currentAssetId) throw new Error("Add both a reference and a current design first.");
  const [ref, cur, existing] = await Promise.all([getAsset(project.referenceAssetId), getAsset(project.currentAssetId), listReviews(projectId)]);
  if (!ref || !cur) throw new Error("One of the images is missing from local storage. Upload it again.");
  const [rp, cp] = await Promise.all([pixelsFromBlob(ref.blob), pixelsFromBlob(cur.blob)]);
  const comparison = stripDiff(compareBuffers(rp, cp, ref, cur));
  const id = newId("rev");
  const measurements = { reference: ref.analysis, current: cur.analysis, comparison };
  const review: Review = {
    id,
    projectId,
    version: (existing[0]?.version ?? 0) + 1,
    createdAt: Date.now(),
    referenceAssetId: ref.id,
    currentAssetId: cur.id,
    measurements,
    issues: buildLocalIssues(measurements, id),
    ai: { state: "skipped" },
    notes: "",
  };
  await put("reviews", review);
  await updateProject(projectId, {});
  emit("reviews");
  return review;
}

export async function attachAiResult(reviewId: string, ai: AiStatus, aiIssues: ReviewIssue[]): Promise<Review> {
  const r = await getReview(reviewId);
  if (!r) throw new Error("This review no longer exists.");
  const kept = r.issues.filter((i) => i.source !== "ai");
  const next: Review = { ...r, ai, issues: sortIssues([...kept, ...aiIssues]) };
  await put("reviews", next);
  emit("reviews");
  return next;
}

export async function setIssueResolved(reviewId: string, issueId: string, resolved: boolean): Promise<Review> {
  const r = await getReview(reviewId);
  if (!r) throw new Error("This review no longer exists.");
  const next: Review = { ...r, issues: r.issues.map((i) => (i.id === issueId ? { ...i, resolved } : i)) };
  await put("reviews", next);
  emit("reviews");
  return next;
}

export async function setReviewNotes(reviewId: string, notes: string): Promise<Review> {
  const r = await getReview(reviewId);
  if (!r) throw new Error("This review no longer exists.");
  const next = { ...r, notes: notes.slice(0, 5000) };
  await put("reviews", next);
  emit("reviews");
  return next;
}

export async function deleteReview(id: string): Promise<void> {
  await remove("reviews", [id]);
  emit("reviews");
}

/* ---------- inspiration ---------- */

export async function listReferences(): Promise<InspirationRef[]> {
  return (await readAll<InspirationRef>("references")).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveReference(input: Omit<InspirationRef, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<InspirationRef> {
  const now = Date.now();
  const prev = input.id ? await readOne<InspirationRef>("references", input.id) : undefined;
  const ref: InspirationRef = {
    ...input,
    id: input.id ?? newId("ref"),
    title: input.title.trim().slice(0, 160) || "Untitled reference",
    tags: Array.from(new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 20),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  await put("references", ref);
  emit("references");
  return ref;
}

export async function deleteReference(id: string): Promise<void> {
  const ref = await readOne<InspirationRef>("references", id);
  await remove("references", [id]);
  if (ref?.assetId) await remove("assets", [ref.assetId]);
  emit("references");
}

/* ---------- styles ---------- */

export async function listStyles(): Promise<StyleSystem[]> {
  return (await readAll<StyleSystem>("styles")).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getStyle = (id: string) => readOne<StyleSystem>("styles", id);

export async function saveStyle(style: StyleSystem): Promise<StyleSystem> {
  const next = { ...style, updatedAt: Date.now() };
  await put("styles", next);
  emit("styles");
  return next;
}

export async function deleteStyle(id: string): Promise<void> {
  await remove("styles", [id]);
  emit("styles");
}

/* ---------- sample project ---------- */

export async function createSampleProject(): Promise<Project> {
  const fetchBlob = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`The sample image ${url} couldn't be loaded.`);
    return res.blob();
  };
  const [refBlob, curBlob] = await Promise.all([fetchBlob(withBase("/samples/reference-poster.png")), fetchBlob(withBase("/samples/current-poster.png"))]);
  const project = await createProject(
    "Sample: Night Market poster",
    "Student club poster for a night market. The reference sets the tone: warm paper, one red accent, big serif title. Readable from three metres.",
    { sample: true },
  );
  const ref = await saveAsset(refBlob, "reference-poster.png", project.id, { sample: true });
  const cur = await saveAsset(curBlob, "current-poster.png", project.id, { sample: true });
  return updateProject(project.id, { referenceAssetId: ref.id, currentAssetId: cur.id });
}

export async function markProjectOpened(id: string): Promise<void> {
  const project = await getProject(id);
  if (!project) throw new Error("This project no longer exists.");
  await put("projects", { ...project, lastOpenedAt: Date.now() });
  emit("projects");
}

/* ---------- designs (poster editor) ---------- */

export async function listDesigns(): Promise<DesignDoc[]> {
  return (await readAll<DesignDoc>("designs")).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getDesign = (id: string) => readOne<DesignDoc>("designs", id);

/** Validate and store a design. Throws with the first schema problem rather than saving a document that can't be reopened. */
export async function saveDesign(doc: DesignDoc): Promise<DesignDoc> {
  const parsed = DesignDocSchema.safeParse({ ...doc, updatedAt: Date.now() });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`The design couldn't be saved: ${issue?.message ?? "it isn't valid"} (${issue?.path.join(".") ?? ""}).`);
  }
  await put("designs", parsed.data);
  emit("designs");
  return parsed.data;
}

export async function createDesign(from: { name: string; width: number; height: number } | { template: Template }): Promise<DesignDoc> {
  const id = newId("design");
  const doc = "template" in from ? docFromTemplate(from.template, id) : blankDoc(id, from.name, from.width, from.height);
  return saveDesign(doc);
}

/** Save a composed or copied document as a new design: fresh id and creation time, everything else kept. */
export const saveNewDesign = (doc: DesignDoc) => saveDesign({ ...doc, id: newId("design"), createdAt: Date.now() });

export async function deleteDesign(id: string): Promise<void> {
  await remove("designs", [id]);
  emit("designs");
}

/* ---------- resources (the user's images and fonts for designs) ---------- */

export async function listResources(kind?: ResourceKind): Promise<Resource[]> {
  const all = await readAll<Resource>("resources");
  return all.filter((r) => !kind || r.kind === kind).sort((a, b) => b.createdAt - a.createdAt);
}
export const getResource = (id: string) => readOne<Resource>("resources", id);

/**
 * Add an image or font after checking its bytes (magic bytes, size, image header dimensions) before anything decodes
 * it. The licence is what the user entered; it's recorded, not verified.
 */
export async function addResource(file: Blob, kind: ResourceKind, meta: { name: string; licence: Licence; tags?: string[]; derivedFrom?: ResourceMeta["derivedFrom"] }): Promise<Resource> {
  let mime: ResourceMeta["mime"];
  let size: { width?: number; height?: number } = {};
  if (kind === "image") {
    const check = await validateImageFile(file);
    if (!check.ok) throw new Error(check.reason);
    mime = MIME_BY_KIND[check.info.kind] as ResourceMeta["mime"];
    size = { width: check.info.width, height: check.info.height };
  } else {
    if (file.size > MAX_FONT_BYTES) throw new Error(`The font is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB.`);
    const check = validateFontFile(new Uint8Array(await file.arrayBuffer()));
    if (!check.ok) throw new Error(check.reason);
    mime = check.mime;
  }
  const now = Date.now();
  const resource: Resource = {
    id: newId("res"),
    kind,
    name: meta.name.trim().slice(0, 200) || (kind === "image" ? "Untitled image" : "Untitled font"),
    mime,
    bytes: file.size,
    ...size,
    licence: meta.licence,
    tags: meta.tags ?? [],
    ...(meta.derivedFrom ? { derivedFrom: meta.derivedFrom } : {}),
    createdAt: now,
    updatedAt: now,
    blob: new Blob([file], { type: mime }),
  };
  const valid = ResourceMetaSchema.safeParse(resource);
  if (!valid.success) throw new Error(`The ${kind} couldn't be added: ${valid.error.issues[0]?.message ?? "invalid details"}.`);
  await put("resources", resource);
  emit("resources");
  return resource;
}

/** Store resources that came with an imported bundle, keeping their ids so the document's references still match. */
async function sha256(bytes: Uint8Array | Blob): Promise<string> {
  const buf = bytes instanceof Blob ? await bytes.arrayBuffer() : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Import a parsed design file without touching anything already here: pictures and fonts get fresh ids (or reuse an
 * identical one already in the library), the document's references are rewritten, and the document gets a fresh id.
 * Resources and document are written in one transaction, so a failure leaves the library exactly as it was.
 */
export async function importDesignBundle(parsed: { doc: DesignDoc; resources: IncomingResource[] }): Promise<{ doc: DesignDoc; added: number; reused: number }> {
  const existing = await listResources();
  const hashes = new Map<string, Promise<string>>();
  const hashOf = (r: Resource) => {
    let h = hashes.get(r.id);
    if (!h) hashes.set(r.id, (h = sha256(r.blob)));
    return h;
  };
  const now = Date.now();
  const plan = await planImport(parsed.doc, parsed.resources, {
    freshId: () => newId("res"),
    docId: newId("design"),
    now,
    existingSame: async (r) => {
      const candidates = existing.filter((e) => e.kind === r.meta.kind && e.mime === r.meta.mime && e.bytes === r.bytes.length);
      if (!candidates.length) return null;
      const want = await sha256(r.bytes);
      for (const c of candidates) if ((await hashOf(c)) === want) return c.id;
      return null;
    },
  });
  const doc = DesignDocSchema.parse(plan.doc);
  await putAll([
    ...plan.store.map((r) => ({ store: "resources" as const, value: { ...r.meta, blob: new Blob([r.bytes as BlobPart], { type: r.meta.mime }) } satisfies Resource })),
    { store: "designs" as const, value: doc },
  ]);
  if (plan.store.length) emit("resources");
  emit("designs");
  return { doc, added: plan.store.length, reused: plan.reused };
}

/** Designs that use a resource, so deleting it can say what will show "Image missing". */
export async function designsUsing(resourceId: string): Promise<DesignDoc[]> {
  return (await listDesigns()).filter((d) => referencedResources(d).includes(resourceId));
}

export async function deleteResource(id: string): Promise<void> {
  await remove("resources", [id]);
  emit("resources");
}

/* ---------- review bridge ---------- */

/**
 * Put a rendered design into review: the PNG becomes the current image of the design's project (created on first
 * use, named after the design). Earlier images stay in the project's history, like any re-upload.
 */
export async function sendDesignToReview(doc: DesignDoc, png: Blob): Promise<Project> {
  let project = doc.projectId ? await getProject(doc.projectId) : undefined;
  if (!project) project = await createProject(doc.name, "Made in the FrameProof poster editor. Add a reference image to compare against.");
  const slug = doc.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "design";
  await setProjectImage(project.id, "current", png, `${slug}.png`);
  if (doc.projectId !== project.id) await saveDesign({ ...doc, projectId: project.id });
  return (await getProject(project.id)) ?? project;
}

/** The design a project's current image came from, if it was made in the editor. */
export async function designForProject(projectId: string): Promise<DesignDoc | undefined> {
  return (await listDesigns()).find((d) => d.projectId === projectId);
}
