"use client";

import { compareBuffers, stripDiff } from "../analysis/analyze";
import { decodeAndAnalyze, pixelsFromBlob } from "../image/decode";
import { buildLocalIssues } from "../review/engine";
import { sortIssues, type ReviewIssue } from "../review/types";
import { getAll, getByProject, getOne, newId, put, remove, type StoreName } from "./db";
import type { AiStatus, Asset, InspirationRef, Project, Review, StyleSystem } from "./models";

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

export const getAsset = (id: string) => getOne<Asset>("assets", id);
export const listAssets = () => getAll<Asset>("assets");

/* ---------- projects ---------- */

export async function listProjects(): Promise<Project[]> {
  return (await getAll<Project>("projects")).sort((a, b) => b.updatedAt - a.updatedAt);
}

export const getProject = (id: string) => getOne<Project>("projects", id);

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
  const [assets, reviews] = await Promise.all([getByProject<Asset>("assets", id), getByProject<Review>("reviews", id)]);
  await remove("reviews", reviews.map((r) => r.id));
  await remove("assets", assets.map((a) => a.id));
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
  return (await getByProject<Review>("reviews", projectId)).sort((a, b) => b.version - a.version);
}

export async function listAllReviews(): Promise<Review[]> {
  return (await getAll<Review>("reviews")).sort((a, b) => b.createdAt - a.createdAt);
}

export const getReview = (id: string) => getOne<Review>("reviews", id);

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
  return (await getAll<InspirationRef>("references")).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveReference(input: Omit<InspirationRef, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<InspirationRef> {
  const now = Date.now();
  const prev = input.id ? await getOne<InspirationRef>("references", input.id) : undefined;
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
  const ref = await getOne<InspirationRef>("references", id);
  await remove("references", [id]);
  if (ref?.assetId) await remove("assets", [ref.assetId]);
  emit("references");
}

/* ---------- styles ---------- */

export async function listStyles(): Promise<StyleSystem[]> {
  return (await getAll<StyleSystem>("styles")).sort((a, b) => b.updatedAt - a.updatedAt);
}
export const getStyle = (id: string) => getOne<StyleSystem>("styles", id);

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
  const [refBlob, curBlob] = await Promise.all([fetchBlob("/samples/reference-poster.png"), fetchBlob("/samples/current-poster.png")]);
  const project = await createProject(
    "Sample: Night Market poster",
    "Student club poster for a night market. The reference sets the tone: warm paper, one red accent, big serif title. Readable from three metres.",
    { sample: true },
  );
  const ref = await saveAsset(refBlob, "reference-poster.png", project.id, { sample: true });
  const cur = await saveAsset(curBlob, "current-poster.png", project.id, { sample: true });
  return updateProject(project.id, { referenceAssetId: ref.id, currentAssetId: cur.id });
}
