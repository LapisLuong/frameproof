"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DesignPreview, useDesignFonts } from "@/components/design/DesignPreview";
import { toast } from "@/components/Toast";
import { useStore } from "@/hooks/useStore";
import { MissingResourcesError, parseBundle } from "@/lib/design/export";
import { docFromTemplate, type Template } from "@/lib/design/library";
import { FORMATS, type DesignDoc } from "@/lib/design/schema";
import { TEMPLATES } from "@/lib/design/templates";
import { createDesign, deleteDesign, importDesignBundle, listDesigns, listResources, saveNewDesign } from "@/lib/store/repo";
import { STARTERS, starterDoc } from "@/lib/design/starters";

const fmtDate = (t: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(t);
const CONCEPT: Record<Template["concept"], string> = {
  exhibition: "Exhibition",
  "type-as-image": "Type as image",
  "editorial-cover": "Editorial cover",
  music: "Music",
  collage: "Collage",
  event: "Event",
};

export function DesignIndex() {
  const router = useRouter();
  const data = useStore(async () => ({ designs: await listDesigns(), resources: await listResources("image") }), ["designs", "resources"]);
  const templateDocs = useMemo(() => TEMPLATES.map((t) => docFromTemplate(t, `preview-${t.id.slice(4)}`, 0)), []);
  const starterDocs = useMemo(() => STARTERS.map((st) => starterDoc(st, `preview-${st.id}`, 0)), []);
  const designs = data.status === "ready" ? data.data.designs : [];
  const fontsVersion = useDesignFonts([...templateDocs, ...starterDocs, ...designs]);
  const urls = useMemo(() => new Map(data.status === "ready" ? data.data.resources.map((r) => [r.id, URL.createObjectURL(r.blob)]) : []), [data]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const [format, setFormat] = useState<string>(FORMATS[0].id);
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const open = (doc: DesignDoc) => router.push(`/design?id=${encodeURIComponent(doc.id)}`);
  const start = async (fn: () => Promise<DesignDoc>) => {
    setBusy(true);
    try {
      open(await fn());
    } catch (e) {
      toast(e instanceof Error ? e.message : "The design couldn't be created.");
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    setImportError(null);
    setBusy(true);
    try {
      // Fresh ids for the document and everything it brings, so nothing already here is overwritten.
      const { doc: saved, added, reused } = await importDesignBundle(parseBundle(await file.text()));
      toast(`Imported ${saved.name}${added || reused ? ` with ${added} new picture${added === 1 ? "" : "s"} or font${added === 1 ? "" : "s"}${reused ? `, ${reused} already in your library` : ""}` : ""}.`);
      open(saved);
    } catch (e) {
      setImportError(
        e instanceof MissingResourcesError
          ? "The file refers to pictures or fonts it doesn't contain, so it can't be imported."
          : e instanceof SyntaxError
            ? "This isn't a FrameProof design file (it isn't valid JSON)."
            : e instanceof Error && e.name === "ZodError"
              ? "This isn't a FrameProof design file, or it was made by a newer version."
              : e instanceof Error
                ? e.message
                : "The file couldn't be imported.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="folio">
        <h1 className="t-title">Designs</h1>
        <p className="t-meta">Posters and covers built from editable layers. Saved in this browser.</p>
      </header>

      <section aria-labelledby="brief-h" className="design-brief-cta">
        <div>
          <h2 id="brief-h" className="t-heading">
            Create from a brief
          </h2>
          <p className="t-meta">Add references, your title and pictures; get three editable concepts in your palette and fonts.</p>
        </div>
        <Link href="/compose" className="btn btn-primary">
          Create from a brief
        </Link>
      </section>

      <section aria-labelledby="starters-h">
        <h2 id="starters-h" className="t-heading">
          Finished starters
        </h2>
        <p className="t-meta" style={{ marginBottom: "1rem" }}>
          Complete designs, ready to edit. Pictures are public-domain artworks from The Met (CC0); swap in your own any time.
        </p>
        <ul className="design-cards" data-testid="starters">
          {STARTERS.map((st, i) => (
            <li key={st.id}>
              <button type="button" className="design-card" disabled={busy} onClick={() => start(() => saveNewDesign(starterDoc(st, "new")))} aria-label={`Edit starter: ${st.template.name}`}>
                <DesignPreview doc={starterDocs[i]!} fontsVersion={fontsVersion} />
                <span className="t-subhead">{st.template.name}</span>
                <span className="hint">
                  {CONCEPT[st.template.concept]} · {st.template.width}×{st.template.height}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <hr className="rule" />

      <section aria-labelledby="tpl-h">
        <h2 id="tpl-h" className="t-heading">
          Templates with empty picture slots
        </h2>
        <p className="t-meta" style={{ marginBottom: "1rem" }}>
          Original layouts in the built-in OFL fonts. Every word, colour and shape is a layer you can change; image slots wait for your own pictures.
        </p>
        <ul className="design-cards" data-testid="templates">
          {TEMPLATES.map((t, i) => (
            <li key={t.id}>
              <button type="button" className="design-card" disabled={busy} onClick={() => start(() => createDesign({ template: t }))} aria-label={`Start from template: ${t.name}`}>
                <DesignPreview doc={templateDocs[i]!} fontsVersion={fontsVersion} />
                <span className="t-subhead">{t.name}</span>
                <span className="hint">
                  {CONCEPT[t.concept]} · {t.width}×{t.height}
                </span>
                <span className="t-small design-card-idea">{t.idea}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <hr className="rule" />

      <section aria-labelledby="blank-h" className="design-start-row">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = FORMATS.find((x) => x.id === format) ?? FORMATS[0];
            void start(() => createDesign({ name: "Untitled design", width: f.width, height: f.height }));
          }}
        >
          <h2 id="blank-h" className="t-heading">
            Start blank
          </h2>
          <div className="design-row" style={{ alignItems: "end" }}>
            <div className="field">
              <label htmlFor="blank-format">Format</label>
              <select id="blank-format" className="select" value={format} onChange={(e) => setFormat(e.target.value)}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}, {f.width}×{f.height}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Create blank design
            </button>
          </div>
        </form>
        <div>
          <h2 className="t-heading">Open a design file</h2>
          <div className="field">
            <label htmlFor="import-design">FrameProof design file (.json)</label>
            <input id="import-design" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            <span className="hint">Made with &ldquo;Export design file&rdquo;. Its pictures and fonts are checked before anything is saved.</span>
          </div>
          {importError ? (
            <p role="alert" className="error-text">
              {importError}
            </p>
          ) : null}
        </div>
      </section>

      <hr className="rule" />

      <section aria-labelledby="mine-h">
        <h2 id="mine-h" className="t-heading">
          Your designs
        </h2>
        {data.status === "loading" ? <div className="busy-line" aria-label="Loading designs" /> : null}
        {data.status === "error" ? (
          <p className="notice" data-tone="error">
            {data.message}
          </p>
        ) : null}
        {data.status === "ready" && !designs.length ? <p className="t-meta">None yet. Start from a template or a blank page.</p> : null}
        {designs.length ? (
          <ul className="design-cards" data-testid="designs">
            {designs.map((d) => (
              <li key={d.id} className="design-card-wrap">
                <Link href={`/design?id=${encodeURIComponent(d.id)}`} className="design-card">
                  <DesignPreview doc={d} urls={urls} fontsVersion={fontsVersion} />
                  <span className="t-subhead">{d.name}</span>
                  <span className="hint">
                    {d.width}×{d.height} · edited {fmtDate(d.updatedAt)}
                    {d.projectId ? " · in review" : ""}
                  </span>
                </Link>
                <ConfirmDialog
                  trigger={
                    <button type="button" className="btn btn-sm btn-quiet">
                      Delete
                    </button>
                  }
                  title={`Delete “${d.name}”?`}
                  body="The design is removed from this browser. Pictures and fonts stay in your library, and any review made from it stays in its project."
                  confirm="Delete design"
                  onConfirm={() => deleteDesign(d.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
