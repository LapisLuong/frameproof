"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Thumb } from "@/components/Thumb";
import { toast } from "@/components/Toast";
import { useStore } from "@/hooks/useStore";
import { createProject, createSampleProject, listAllReviews, listAssets, listProjects, listStyles } from "@/lib/store/repo";
import type { Asset, Project, Review, StyleSystem } from "@/lib/store/models";

const fmtDate = (t: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(t);

type DeskData = { projects: Project[]; assets: Map<string, Asset>; reviews: Review[]; styles: StyleSystem[]; analyses: Asset[] };

async function loadDesk(): Promise<DeskData> {
  const [projects, assets, reviews, styles] = await Promise.all([listProjects(), listAssets(), listAllReviews(), listStyles()]);
  return {
    projects,
    assets: new Map(assets.map((a) => [a.id, a])),
    reviews,
    styles,
    analyses: assets.filter((a) => a.projectId === null).sort((a, b) => b.createdAt - a.createdAt),
  };
}

function NewProjectForm({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      aria-labelledby="new-h"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Give the project a name.");
          inputRef.current?.focus();
          return;
        }
        setBusy(true);
        try {
          const p = await createProject(name, brief);
          toast("Project created");
          router.push(`/projects/${p.id}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "The project couldn't be saved.");
          setBusy(false);
        }
      }}
      style={{ display: "grid", gap: "0.9rem" }}
    >
      <h2 id="new-h" className="t-heading">
        New project
      </h2>
      <div className="field">
        <label htmlFor="pname">Name</label>
        <input ref={inputRef} id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Event Poster" maxLength={120} aria-invalid={!!error} aria-describedby={error ? "pname-err" : undefined} />
        {error ? (
          <p id="pname-err" className="error-text">
            {error}
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="pbrief">Brief (optional)</label>
        <textarea id="pbrief" className="textarea" value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={2000} placeholder="Who it's for, where it will be seen, and what should be read first." />
        <p className="hint">The brief is used in AI review when it is turned on, and printed on exported revision briefs.</p>
      </div>
      <div>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}

export function Desk() {
  const router = useRouter();
  const data = useStore(loadDesk, ["projects", "assets", "reviews", "styles"]);
  const nameRef = useRef<HTMLInputElement>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);

  if (data.status === "loading") return <div className="page"><p className="t-meta">Opening your desk…</p></div>;
  if (data.status === "error")
    return (
      <div className="page">
        <p className="notice" data-tone="error" role="alert">
          {data.message}
        </p>
      </div>
    );

  const { projects, assets, reviews, styles, analyses } = data.data;
  const reviewsBy = new Map<string, Review[]>();
  for (const r of reviews) reviewsBy.set(r.projectId, [...(reviewsBy.get(r.projectId) ?? []), r]);
  const hasSample = projects.some((p) => p.sample);

  const openSample = async () => {
    setSampleBusy(true);
    setSampleError(null);
    try {
      const p = await createSampleProject();
      router.push(`/projects/${p.id}`);
    } catch (e) {
      setSampleError(e instanceof Error ? e.message : "The sample project couldn't be created.");
      setSampleBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="spread">
        <div>
          <div className="folio">
            <h1 className="t-display">Desk</h1>
            <p className="t-meta">
              {projects.length === 0 ? "Nothing here yet" : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
            </p>
          </div>

          {projects.length === 0 ? (
            <section aria-label="Getting started" style={{ display: "grid", gap: "1.25rem", marginBottom: "2.5rem" }}>
              <p className="prose-serif">
                Pair a design you admire with the one you&apos;re making. FrameProof measures both, shows you where they differ, and turns that into a revision brief you can act on.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button className="btn" type="button" onClick={openSample} disabled={sampleBusy}>
                  {sampleBusy ? "Preparing the sample…" : "Open the sample project"}
                </button>
              </div>
              <p className="t-small">The sample uses two posters made for this demo. Its findings are computed live, the same way as for your own images.</p>
              {sampleError ? (
                <p className="error-text" role="alert">
                  {sampleError}
                </p>
              ) : null}
            </section>
          ) : (
            <ul className="ledger" aria-label="Projects" style={{ marginBottom: "2.5rem" }}>
              {projects.map((p) => {
                const rs = reviewsBy.get(p.id) ?? [];
                const latest = rs.sort((a, b) => b.version - a.version)[0];
                const open = latest?.issues.filter((i) => !i.resolved).length;
                const ref = p.referenceAssetId ? assets.get(p.referenceAssetId) : undefined;
                const cur = p.currentAssetId ? assets.get(p.currentAssetId) : undefined;
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="ledger-row" data-testid="project-row">
                      <span className="pair" aria-hidden="true">
                        <Thumb blob={ref?.thumb} alt="" />
                        <Thumb blob={cur?.thumb} alt="" />
                      </span>
                      <span style={{ display: "grid", gap: "0.2rem", minWidth: 0 }}>
                        <span className="t-heading" style={{ overflowWrap: "anywhere" }}>
                          {p.name} {p.sample ? <span className="sample-badge">Sample</span> : null}
                        </span>
                        {p.brief ? (
                          <span className="t-meta" style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                            {p.brief}
                          </span>
                        ) : null}
                      </span>
                      <span className="t-meta" style={{ textAlign: "right" }}>
                        {latest ? `Review ${latest.version}, ${open} open` : ref && cur ? "Ready to review" : "Needs images"}
                        <br />
                        <span className="t-small">Updated {fmtDate(p.updatedAt)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <NewProjectForm inputRef={nameRef} />
          {projects.length > 0 && !hasSample ? (
            <p className="t-small" style={{ marginTop: "1.5rem" }}>
              Want to see a finished review first?{" "}
              <button type="button" className="btn-quiet btn" onClick={openSample} disabled={sampleBusy} style={{ padding: 0, minHeight: 0 }}>
                Open the sample project
              </button>
            </p>
          ) : null}
        </div>

        <aside className="margin" aria-label="Recent work">
          <section aria-labelledby="recent-reviews-h">
            <h2 id="recent-reviews-h" className="t-subhead">
              Recent reviews
            </h2>
            {reviews.length === 0 ? (
              <p className="t-meta" style={{ marginTop: "0.4rem" }}>
                Reviews appear here once a project has both images.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.6rem" }}>
                {reviews.slice(0, 5).map((r) => {
                  const p = projects.find((x) => x.id === r.projectId);
                  return (
                    <li key={r.id}>
                      <Link className="link" href={`/projects/${r.projectId}?review=${r.id}`}>
                        {p?.name ?? "Deleted project"}, review {r.version}
                      </Link>
                      <p className="t-small">
                        {r.issues.filter((i) => !i.resolved).length} open of {r.issues.length}, {fmtDate(r.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <hr className="rule" />
          <section aria-labelledby="recent-analyses-h">
            <h2 id="recent-analyses-h" className="t-subhead">
              Recent analyses
            </h2>
            {analyses.length === 0 ? (
              <p className="t-meta" style={{ marginTop: "0.4rem" }}>
                Analyze a single image to pull its palette and measurements. <Link className="link" href="/analyze">Open the analyzer</Link>
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.6rem" }}>
                {analyses.slice(0, 4).map((a) => (
                  <li key={a.id} style={{ display: "grid", gridTemplateColumns: "2.5rem 1fr", gap: "0.6rem", alignItems: "center" }}>
                    <Thumb blob={a.thumb} alt="" style={{ maxWidth: "2.5rem", maxHeight: "2.5rem", objectFit: "contain", border: "1px solid var(--color-rule)" }} />
                    <Link className="link" href={`/analyze?asset=${a.id}`} style={{ overflowWrap: "anywhere" }}>
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <hr className="rule" />
          <section aria-labelledby="styles-h">
            <h2 id="styles-h" className="t-subhead">
              Saved styles
            </h2>
            {styles.length === 0 ? (
              <p className="t-meta" style={{ marginTop: "0.4rem" }}>
                Save a palette from the analyzer to start a style.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.75rem" }}>
                {styles.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <Link className="link" href={`/styles?id=${s.id}`}>
                      {s.name}
                    </Link>
                    <div className="palette-strip" style={{ height: "0.6rem", marginTop: "0.3rem" }} aria-hidden="true">
                      {s.palette.map((c, i) => (
                        <span key={i} style={{ flex: 1, background: c.hex }} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
