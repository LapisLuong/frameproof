"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useStore } from "@/hooks/useStore";
import { cssFamily, loadDocFonts, measureText } from "@/lib/design/browser";
import { getBuiltinArt } from "@/lib/design/art";
import { MissingResourcesError, parseBundle } from "@/lib/design/export";
import { artUrl } from "@/lib/design/exporters";
import { docFromTemplate, type Template } from "@/lib/design/library";
import { renderSvg } from "@/lib/design/render";
import { FORMATS, type DesignDoc } from "@/lib/design/schema";
import { TEMPLATES } from "@/lib/design/templates";
import { newId } from "@/lib/store/db";
import { createDesign, deleteDesign, getDesign, importResources, listDesigns, listResources, saveDesign } from "@/lib/store/repo";

const fmtDate = (t: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(t);
const CONCEPT: Record<Template["concept"], string> = {
  exhibition: "Exhibition",
  "type-as-image": "Type as image",
  "editorial-cover": "Editorial cover",
  music: "Music",
  collage: "Collage",
  event: "Event",
};

/** A small, static rendering of a document for cards. Placeholders show where the user's pictures go. */
function Preview({ doc, urls, fontsVersion }: { doc: DesignDoc; urls?: Map<string, string>; fontsVersion: number }) {
  // Rendered only in the browser, once fonts have loaded, so line breaks use real metrics (and match hydration).
  const svg = useMemo(
    () =>
      fontsVersion === 0
        ? ""
        : renderSvg(doc, { measure: measureText, fontFamily: cssFamily, image: (id) => urls?.get(id) ?? (getBuiltinArt(id) ? artUrl(getBuiltinArt(id)!) : null), placeholders: true, idPrefix: `pv-${doc.id}` }).replace(
        "<svg ",
        '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" ',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, urls, fontsVersion],
  );
  return <span className="design-card-preview" style={{ aspectRatio: `${doc.width} / ${doc.height}` }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function useFonts(docs: DesignDoc[]): number {
  const [v, setV] = useState(0);
  const key = docs.map((d) => d.id + d.updatedAt).join(",");
  useEffect(() => {
    let live = true;
    Promise.all(docs.map((d) => loadDocFonts(d))).then(() => live && setV((x) => x + 1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return v;
}

export function DesignIndex() {
  const router = useRouter();
  const data = useStore(async () => ({ designs: await listDesigns(), resources: await listResources("image") }), ["designs", "resources"]);
  const templateDocs = useMemo(() => TEMPLATES.map((t) => docFromTemplate(t, `preview-${t.id.slice(4)}`, 0)), []);
  const designs = data.status === "ready" ? data.data.designs : [];
  const fontsVersion = useFonts([...templateDocs, ...designs]);
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
      const { doc, resources } = parseBundle(await file.text());
      // Keep ids so the document's references still match; give the document a new id if this browser has one.
      const id = (await getDesign(doc.id)) ? newId("design") : doc.id;
      await importResources(resources);
      const saved = await saveDesign({ ...doc, id, projectId: null });
      toast(`Imported ${saved.name}.`);
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

      <section aria-labelledby="tpl-h">
        <h2 id="tpl-h" className="t-heading">
          Start from a template
        </h2>
        <p className="t-meta" style={{ marginBottom: "1rem" }}>
          Original layouts in the built-in OFL fonts. Every word, colour and shape is a layer you can change; image slots wait for your own pictures.
        </p>
        <ul className="design-cards" data-testid="templates">
          {TEMPLATES.map((t, i) => (
            <li key={t.id}>
              <button type="button" className="design-card" disabled={busy} onClick={() => start(() => createDesign({ template: t }))} aria-label={`Start from template: ${t.name}`}>
                <Preview doc={templateDocs[i]!} fontsVersion={fontsVersion} />
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
                  <Preview doc={d} urls={urls} fontsVersion={fontsVersion} />
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
