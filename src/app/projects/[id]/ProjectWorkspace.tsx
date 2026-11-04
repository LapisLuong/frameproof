"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CompareStage, type StageMarks } from "@/components/CompareStage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dropzone } from "@/components/Dropzone";
import { MeasurementTable, PaletteList } from "@/components/Measurements";
import { ProofNotes, type NoteSelection } from "@/components/ProofNotes";
import { toast } from "@/components/Toast";
import { useAiStatus } from "@/hooks/useAiStatus";
import { useStore } from "@/hooks/useStore";
import { AiReviewSchema, toIssues, type MeasuredContext } from "@/lib/ai/schema";
import { download, fileSlug, reviewToJson, reviewToMarkdown } from "@/lib/review/report";
import { noteNumber, type ReviewIssue } from "@/lib/review/types";
import {
  attachAiResult,
  deleteProject,
  getAsset,
  getProject,
  listReviews,
  runLocalReview,
  setIssueResolved,
  setProjectImage,
  setReviewNotes,
  updateProject,
} from "@/lib/store/repo";
import type { Asset, Project, Review } from "@/lib/store/models";

type Data = { project: Project; reference: Asset | null; current: Asset | null; reviews: Review[] };

async function load(id: string): Promise<Data | null> {
  const project = await getProject(id);
  if (!project) return null;
  const [reference, current, reviews] = await Promise.all([
    project.referenceAssetId ? getAsset(project.referenceAssetId) : Promise.resolve(undefined),
    project.currentAssetId ? getAsset(project.currentAssetId) : Promise.resolve(undefined),
    listReviews(id),
  ]);
  return { project, reference: reference ?? null, current: current ?? null, reviews };
}

function ImageSlot({ role, asset, projectId }: { role: "reference" | "current"; asset: Asset | null; projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = role === "reference" ? "Reference" : "Current design";
  const onFile = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      await setProjectImage(projectId, role, f, f.name);
      toast(`${label} ${asset ? "replaced" : "added"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The image couldn't be added.");
    } finally {
      setBusy(false);
    }
  };
  if (asset)
    return (
      <div>
        <div className="file-row">
          <span className="t-meta" style={{ minWidth: "5.5rem" }}>
            {label}
          </span>
          <span style={{ overflowWrap: "anywhere", flex: 1 }}>{asset.name}</span>
          <span className="t-value t-meta">
            {asset.width}×{asset.height}
          </span>
          <label className="btn btn-sm" aria-disabled={busy}>
            {busy ? "Measuring…" : "Replace…"}
            <input
              type="file"
              className="sr-only"
              data-testid={`upload-${role}`}
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={busy}
              aria-label={`Replace ${label.toLowerCase()}`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onFile(f);
              }}
            />
          </label>
        </div>
        {error ? (
          <p className="error-text" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      <h2 className="t-subhead">{label}</h2>
      <Dropzone
        label={`Add the ${label.toLowerCase()}`}
        hint={
          role === "reference"
            ? "The piece you want to learn from. PNG, JPEG, WebP or GIF, up to 15 MB."
            : "Your work in progress. PNG, JPEG, WebP or GIF, up to 15 MB."
        }
        busy={busy}
        error={error}
        onFile={onFile}
        testId={`upload-${role}`}
      />
    </div>
  );
}

/** Marks for unresolved notes that carry a measured location, numbered like the margin notes. */
function marksFor(review: Review | null, fresh: boolean): StageMarks {
  const out: StageMarks = { reference: [], current: [] };
  if (!review || !fresh) return out;
  for (const issue of review.issues) {
    if (issue.resolved) continue;
    for (const a of issue.anchors ?? []) {
      out[a.image].push({ id: issue.id, n: noteNumber(review.issues, issue), x: a.x, y: a.y, label: a.label, title: issue.title });
    }
  }
  return out;
}

function ReviewControls({
  data,
  review,
  onSelect,
  selection,
  onShowOnArtwork,
}: {
  data: Data;
  review: Review | null;
  onSelect: (id: string) => void;
  selection: NoteSelection;
  onShowOnArtwork: (issue: ReviewIssue) => void;
}) {
  const ai = useAiStatus();
  const [busy, setBusy] = useState<"local" | "ai" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [notes, setNotes] = useState(review?.notes ?? "");
  const [notesState, setNotesState] = useState<"saved" | "dirty" | "saving">("saved");

  const stale = review && data.reference && data.current && (review.referenceAssetId !== data.reference.id || review.currentAssetId !== data.current.id);

  const runLocal = async () => {
    setBusy("local");
    setError(null);
    try {
      const r = await runLocalReview(data.project.id);
      onSelect(r.id);
      toast(`Review ${r.version} saved`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The review couldn't be run.");
    } finally {
      setBusy(null);
    }
  };

  const runAi = async () => {
    if (!review || !data.reference || !data.current) return;
    setBusy("ai");
    setError(null);
    const m = review.measurements;
    const ctx: MeasuredContext = {
      reference: {
        width: m.reference.width,
        height: m.reference.height,
        palette: m.reference.palette.swatches.map((s) => ({ hex: s.hex, share: Number(s.share.toFixed(3)) })),
      },
      current: {
        width: m.current.width,
        height: m.current.height,
        palette: m.current.palette.swatches.map((s) => ({ hex: s.hex, share: Number(s.share.toFixed(3)) })),
      },
      localFindings: review.issues.filter((i) => i.source === "local").map((i) => i.title),
    };
    const form = new FormData();
    form.set("reference", data.reference.blob, data.reference.name);
    form.set("current", data.current.blob, data.current.name);
    form.set("brief", data.project.brief);
    form.set("context", JSON.stringify(ctx));
    try {
      const res = await fetch("/api/review", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; provider?: string; model?: string; review?: unknown } | null;
      if (!res.ok || !body?.ok) {
        const message = body?.error ?? `The AI review failed (${res.status}).`;
        await attachAiResult(review.id, { state: "failed", provider: body?.provider ?? (ai.state === "on" ? ai.provider : "unknown"), message }, []);
        setError(`${message} The local findings are unchanged.`);
        return;
      }
      // Validate again on the client: never display unvalidated model output.
      const parsed = AiReviewSchema.safeParse(body.review);
      if (!parsed.success) {
        await attachAiResult(review.id, { state: "failed", provider: body.provider ?? "unknown", message: "The answer didn't match the review format." }, []);
        setError("The AI answer didn't match the review format, so it was discarded.");
        return;
      }
      const summary = parsed.data.uncertainty ? `${parsed.data.summary} Uncertain: ${parsed.data.uncertainty}` : parsed.data.summary;
      await attachAiResult(review.id, { state: "ok", provider: body.provider ?? "", model: body.model ?? "", summary }, toIssues(parsed.data, review.id));
      toast("AI notes added");
    } catch {
      setError("Couldn't reach the FrameProof server for AI review. The local findings are unchanged.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (issue: ReviewIssue, resolved: boolean) => {
    if (!review) return;
    setTogglingId(issue.id);
    try {
      await setIssueResolved(review.id, issue.id, resolved);
      toast(resolved ? "Marked resolved" : "Reopened");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The change couldn't be saved.");
    } finally {
      setTogglingId(null);
    }
  };

  const saveNotes = async () => {
    if (!review) return;
    setNotesState("saving");
    try {
      await setReviewNotes(review.id, notes);
      setNotesState("saved");
      toast("Notes saved");
    } catch {
      setNotesState("dirty");
      setError("Notes couldn't be saved. Your text is still here; try again.");
    }
  };

  // Warn before leaving with unsaved notes.
  useEffect(() => {
    if (notesState !== "dirty") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [notesState]);

  const exportAs = (kind: "md" | "json") => {
    if (!review) return;
    const name = `${fileSlug(data.project.name)}-review-${review.version}`;
    if (kind === "md") download(`${name}.md`, reviewToMarkdown(data.project, review), "text/markdown;charset=utf-8");
    else download(`${name}.json`, reviewToJson(data.project, review), "application/json");
    toast(kind === "md" ? "Revision brief exported" : "Review JSON exported");
  };

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {data.reviews.length > 0 ? (
        <div className="field">
          <label htmlFor="rev-select">Review version</label>
          <select id="rev-select" className="select" value={review?.id ?? ""} onChange={(e) => onSelect(e.target.value)}>
            {data.reviews.map((r) => (
              <option key={r.id} value={r.id}>
                Review {r.version},{" "}
                {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(r.createdAt)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {stale ? (
        <p className="notice" role="status">
          The images changed after review {review.version}. Run a new review to measure the current pair; this one is kept for history.
        </p>
      ) : null}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={review && !stale ? "btn" : "btn btn-primary"}
          onClick={runLocal}
          disabled={!!busy || !data.reference || !data.current}
          data-testid="run-review"
        >
          {busy === "local" ? "Measuring…" : review ? "Run a new review" : "Run review"}
        </button>
        {ai.state === "on" ? (
          <button type="button" className="btn" onClick={runAi} disabled={!!busy || !review || !!stale}>
            {busy === "ai" ? "Asking the model…" : review?.ai.state === "ok" ? "Ask AI again" : "Ask AI for a second opinion"}
          </button>
        ) : null}
      </div>
      {busy ? <div className="busy-line" aria-hidden="true" /> : null}
      {error ? (
        <p className="notice" data-tone="error" role="alert">
          {error}
        </p>
      ) : null}

      {review ? (
        <>
          <div className="t-meta" data-testid="ai-state">
            {review.ai.state === "ok" ? (
              <p>
                <span className="evidence" data-type="ai-observed">
                  AI-observed
                </span>{" "}
                notes from {review.ai.model}. {review.ai.summary}
              </p>
            ) : review.ai.state === "failed" ? (
              <p>AI review failed: {review.ai.message} Only local measurements are shown.</p>
            ) : ai.state === "off" ? (
              <p title={ai.reason}>Local measurements only.</p>
            ) : ai.state === "on" ? (
              <p>Local measurements. You can ask a vision model for notes on hierarchy and type.</p>
            ) : null}
          </div>

          <ProofNotes
            issues={review.issues}
            onToggle={toggle}
            busyId={togglingId}
            selection={selection}
            onShowOnArtwork={stale ? undefined : onShowOnArtwork}
          />

          <div className="field">
            <label htmlFor="rev-notes">Your notes on this review</label>
            <textarea
              id="rev-notes"
              className="textarea"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesState("dirty");
              }}
              maxLength={5000}
              placeholder="Decisions, things to try, what the client said."
            />
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <button type="button" className="btn btn-sm" onClick={saveNotes} disabled={notesState !== "dirty"}>
                {notesState === "saving" ? "Saving…" : "Save notes"}
              </button>
              <span className="t-small" aria-live="polite">
                {notesState === "dirty" ? "Unsaved changes" : "Saved"}
              </span>
            </div>
          </div>

          <div>
            <h2 className="t-subhead">Export</h2>
            <p className="t-small" style={{ margin: "0.25rem 0 0.6rem" }}>
              The revision brief lists open and resolved notes with their evidence and measurements.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-sm" onClick={() => exportAs("md")} data-testid="export-md">
                Export revision brief (.md)
              </button>
              <button type="button" className="btn btn-sm" onClick={() => exportAs("json")} data-testid="export-json">
                Export JSON
              </button>
            </div>
          </div>
        </>
      ) : data.reference && data.current ? (
        <p className="t-meta">Both images are in. Run the review to measure them and get margin notes.</p>
      ) : (
        <p className="t-meta">Add a reference and your current design. The review starts as soon as both are in.</p>
      )}
    </div>
  );
}

function EditProject({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [brief, setBrief] = useState(project.brief);
  if (!open)
    return (
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(true)}>
        Edit name and brief
      </button>
    );
  return (
    <form
      style={{ display: "grid", gap: "0.75rem", maxWidth: "40rem", margin: "0.75rem 0 1.5rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        await updateProject(project.id, { name: name.trim() || project.name, brief });
        toast("Project saved");
        setOpen(false);
      }}
    >
      <div className="field">
        <label htmlFor="ename">Name</label>
        <input id="ename" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="ebrief">Brief</label>
        <textarea id="ebrief" className="textarea" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={2000} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="btn btn-primary btn-sm" type="submit">
          Save project
        </button>
        <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ProjectWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const data = useStore(() => load(id), ["projects", "assets", "reviews"], [id]);
  const [selected, setSelected] = useState<string | null>(params.get("review"));
  const [noteSelection, setNoteSelection] = useState<NoteSelection>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const autoRan = useRef(false);

  // First time both images are present and there's no review yet, run one automatically.
  const ready = data.status === "ready" && data.data;
  useEffect(() => {
    if (!ready || autoRan.current) return;
    if (ready.reference && ready.current && ready.reviews.length === 0) {
      autoRan.current = true;
      runLocalReview(id)
        .then((r) => {
          setSelected(r.id);
          toast(`Review ${r.version} saved`);
        })
        .catch(() => {
          autoRan.current = false;
        });
    }
  }, [ready, id]);

  if (data.status === "loading")
    return (
      <div className="page">
        <p className="t-meta">Opening project…</p>
      </div>
    );
  if (data.status === "error")
    return (
      <div className="page">
        <p className="notice" data-tone="error" role="alert">
          {data.message}
        </p>
      </div>
    );
  if (!data.data)
    return (
      <div className="page">
        <h1 className="t-title">Project not found</h1>
        <p className="t-meta" style={{ marginTop: "0.5rem" }}>
          It may have been deleted, or it was saved in a different browser. Work is stored per browser.
        </p>
        <p style={{ marginTop: "1rem" }}>
          <Link className="link" href="/">
            Back to the desk
          </Link>
        </p>
      </div>
    );

  const d = data.data;
  const review = d.reviews.find((r) => r.id === selected) ?? d.reviews[0] ?? null;
  const fresh = !!(review && d.reference && d.current && review.referenceAssetId === d.reference.id && review.currentAssetId === d.current.id);
  const marks = marksFor(review, fresh);

  return (
    <div className="page">
      <div className="folio">
        <div>
          <p className="t-meta">
            <Link className="link" href="/">
              Desk
            </Link>
          </p>
          <h1 className="t-title" style={{ overflowWrap: "anywhere" }}>
            {d.project.name} {d.project.sample ? <span className="sample-badge">Sample</span> : null}
          </h1>
          {d.project.brief ? (
            <p className="t-meta t-measure" style={{ marginTop: "0.35rem" }}>
              {d.project.brief}
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <EditProject key={d.project.updatedAt} project={d.project} />
          <ConfirmDialog
            trigger={
              <button type="button" className="btn btn-quiet btn-sm btn-danger">
                Delete project
              </button>
            }
            title="Delete this project?"
            body="Its images, reviews and notes are removed from this browser. Exported files are not affected. This can't be undone."
            confirm="Delete project"
            onConfirm={async () => {
              await deleteProject(d.project.id);
              toast("Project deleted");
              router.push("/");
            }}
          />
        </div>
      </div>

      <div className="spread spread-review">
        {d.reference && d.current ? (
          <div className="area-stage" ref={stageRef}>
            <CompareStage
              reference={d.reference}
              current={d.current}
              marks={marks}
              selectedId={noteSelection?.id ?? null}
              onSelect={(noteId) => setNoteSelection({ id: noteId, from: "mark" })}
            />
          </div>
        ) : null}
        <div className="area-details" style={{ display: "grid", gap: "2rem", minWidth: 0 }}>
          <div
            style={
              d.reference && d.current
                ? { display: "grid", gap: 0 }
                : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))", gap: "1.5rem" }
            }
          >
            <ImageSlot role="reference" asset={d.reference} projectId={d.project.id} />
            <ImageSlot role="current" asset={d.current} projectId={d.project.id} />
          </div>
          {review ? (
            <>
              <MeasurementTable reference={review.measurements.reference} current={review.measurements.current} comparison={review.measurements.comparison} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))", gap: "2rem" }}>
                <div>
                  <h2 className="t-subhead" style={{ marginBottom: "0.6rem" }}>
                    Reference palette
                  </h2>
                  <PaletteList analysis={review.measurements.reference} title="Reference palette" />
                </div>
                <div>
                  <h2 className="t-subhead" style={{ marginBottom: "0.6rem" }}>
                    Current palette
                  </h2>
                  <PaletteList analysis={review.measurements.current} title="Current palette" />
                </div>
              </div>
            </>
          ) : null}
        </div>
        <aside className="margin area-margin" aria-label="Review">
          {/* keyed by review so the notes field resets when another version is selected */}
          <ReviewControls
            key={review?.id ?? "none"}
            data={d}
            review={review}
            onSelect={setSelected}
            selection={noteSelection}
            onShowOnArtwork={(issue) => {
              setNoteSelection({ id: issue.id, from: "note" });
              const stage = stageRef.current;
              if (!stage) return;
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              stage.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
            }}
          />
        </aside>
      </div>
    </div>
  );
}
