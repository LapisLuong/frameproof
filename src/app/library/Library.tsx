"use client";

import Link from "next/link";
import { BuiltinShelf } from "@/components/library/BuiltinShelf";
import { Dialog } from "radix-ui";
import { useMemo, useState, useRef, useEffect } from "react";
import { ConfirmDialog, useDraftGuard } from "@/components/ConfirmDialog";
import { Dropzone } from "@/components/Dropzone";
import { PaletteList } from "@/components/Measurements";
import { Thumb } from "@/components/Thumb";
import { toast } from "@/components/Toast";
import { useStore } from "@/hooks/useStore";
import { deleteReference, listAssets, listReferences, saveAsset, saveReference } from "@/lib/store/repo";
import { REFERENCE_CATEGORIES, type Asset, type InspirationRef, type ReferenceCategory } from "@/lib/store/models";

/** Only http(s) links are stored or rendered as links. */
export function safeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

type Draft = {
  id?: string;
  title: string;
  url: string;
  attribution: string;
  category: ReferenceCategory;
  tags: string;
  collection: string;
  notes: string;
  assetId: string | null;
};
const EMPTY: Draft = { title: "", url: "", attribution: "", category: "Editorial", tags: "", collection: "", notes: "", assetId: null };

function Editor({
  initial,
  collections,
  onDone,
  closeRef,
}: {
  initial: Draft;
  collections: string[];
  onDone: () => void;
  closeRef: React.RefObject<(() => void) | null>;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [img, setImg] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guard = useDraftGuard(JSON.stringify(d) !== JSON.stringify(initial) || !!img);
  useEffect(() => {
    closeRef.current = () => {
      if (!busy) guard.request(onDone);
    };
    return () => {
      closeRef.current = null;
    };
  }, [busy, guard, onDone, closeRef]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  return (
    <form
      style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const url = d.url.trim() ? safeUrl(d.url) : "";
        if (url === null) return setError("The link must be a web address starting with http:// or https://.");
        if (!d.title.trim() && !img && !url) return setError("Add a title, a link or an image.");
        setBusy(true);
        try {
          let assetId = d.assetId;
          if (img) assetId = (await saveAsset(img, img.name, null)).id;
          await saveReference({
            id: d.id,
            title: d.title || img?.name.replace(/\.[a-z0-9]+$/i, "") || (url ? new URL(url).hostname : "Untitled reference"),
            url: url ?? "",
            attribution: d.attribution.trim().slice(0, 200),
            category: d.category,
            tags: d.tags.split(","),
            collection: d.collection.trim().slice(0, 80),
            notes: d.notes.slice(0, 2000),
            assetId,
          });
          toast(d.id ? "Reference updated" : "Reference saved");
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "The reference couldn't be saved.");
          setBusy(false);
        }
      }}
    >
      {guard.dialog}
      <div className="field">
        <label htmlFor="r-title">Title</label>
        <input id="r-title" className="input" value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
      </div>
      <div className="field">
        <label htmlFor="r-url">Link to the original</label>
        <input id="r-url" className="input" inputMode="url" value={d.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" />
        <p className="hint">FrameProof stores the link only. It never downloads or copies the page.</p>
      </div>
      <div className="field">
        <label htmlFor="r-attr">Credit</label>
        <input
          id="r-attr"
          className="input"
          value={d.attribution}
          onChange={(e) => set("attribution", e.target.value)}
          placeholder="Designer or studio, publication, year"
          maxLength={200}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "1rem" }}>
        <div className="field">
          <label htmlFor="r-cat">Category</label>
          <select id="r-cat" className="select" value={d.category} onChange={(e) => set("category", e.target.value as ReferenceCategory)}>
            {REFERENCE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-col">Collection</label>
          <input
            id="r-col"
            className="input"
            list="collections"
            value={d.collection}
            onChange={(e) => set("collection", e.target.value)}
            maxLength={80}
            placeholder="Event Poster moodboard"
          />
          <datalist id="collections">
            {collections.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="field">
        <label htmlFor="r-tags">Tags</label>
        <input id="r-tags" className="input" value={d.tags} onChange={(e) => set("tags", e.target.value)} placeholder="serif, asymmetric, warm" />
        <p className="hint">Separate tags with commas.</p>
      </div>
      <div className="field">
        <label htmlFor="r-notes">What you want to learn from it</label>
        <textarea id="r-notes" className="textarea" value={d.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
      </div>
      <div className="field">
        <span className="label">{d.assetId ? "Replace image" : "Image (optional)"}</span>
        <Dropzone
          compact
          label={img ? img.name : "Choose an image"}
          hint="A screenshot or saved file you're allowed to keep. PNG, JPEG, WebP or GIF."
          onFile={setImg}
          testId="upload-reference"
        />
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button type="button" className="btn" disabled={busy} onClick={() => guard.request(onDone)}>
          Cancel
        </button>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : d.id ? "Save changes" : "Save reference"}
        </button>
      </div>
    </form>
  );
}

function Detail({ item, asset, onEdit, onClose }: { item: InspirationRef; asset?: Asset; onEdit: () => void; onClose: () => void }) {
  const link = safeUrl(item.url);
  return (
    <div style={{ display: "grid", gap: "1rem", marginTop: "0.75rem" }}>
      {asset ? (
        <Thumb
          blob={asset.thumb}
          alt={item.title}
          style={{ maxHeight: "50vh", maxWidth: "100%", objectFit: "contain", justifySelf: "start", border: "1px solid var(--color-rule)" }}
        />
      ) : null}
      <p className="t-meta">
        {item.category}
        {item.collection ? `, in ${item.collection}` : ""}
        {item.tags.length ? `. Tags: ${item.tags.join(", ")}` : ""}
      </p>
      {item.attribution ? <p>Credit: {item.attribution}</p> : null}
      {link ? (
        <p>
          <a className="link" href={link} target="_blank" rel="noopener noreferrer nofollow">
            Open the original ({new URL(link).hostname})
          </a>
        </p>
      ) : null}
      {item.notes ? (
        <p className="t-measure" style={{ whiteSpace: "pre-wrap" }}>
          {item.notes}
        </p>
      ) : null}
      {asset ? <PaletteList analysis={asset.analysis} title="Measured palette" /> : null}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <ConfirmDialog
          trigger={
            <button type="button" className="btn btn-danger">
              Delete
            </button>
          }
          title="Delete this reference?"
          body="It's removed from the library in this browser, with its image. The original page is not affected."
          confirm="Delete reference"
          onConfirm={async () => {
            await deleteReference(item.id);
            toast("Reference deleted");
            onClose();
          }}
        />
        {asset ? (
          <Link className="btn" href={`/analyze?asset=${asset.id}`}>
            Open in analyzer
          </Link>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  );
}

export function Library() {
  const data = useStore(async () => {
    const [refs, assets] = await Promise.all([listReferences(), listAssets()]);
    return { refs, assets: new Map(assets.map((a) => [a.id, a])) };
  }, ["references", "assets"]);
  const closeRef = useRef<(() => void) | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ReferenceCategory | "All">("All");
  const [col, setCol] = useState("");
  const [dialog, setDialog] = useState<{ mode: "new" } | { mode: "view" | "edit"; id: string } | null>(null);

  const refs = useMemo(() => (data.status === "ready" ? data.data.refs : []), [data]);
  const collections = useMemo(() => Array.from(new Set(refs.map((r) => r.collection).filter(Boolean))).sort(), [refs]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return refs.filter(
      (r) =>
        (cat === "All" || r.category === cat) &&
        (!col || r.collection === col) &&
        (!needle || r.title.toLowerCase().includes(needle) || r.tags.some((t) => t.includes(needle)) || r.attribution.toLowerCase().includes(needle)),
    );
  }, [refs, q, cat, col]);

  const active = dialog && dialog.mode !== "new" ? refs.find((r) => r.id === dialog.id) : undefined;
  const assets = data.status === "ready" ? data.data.assets : new Map<string, Asset>();

  return (
    <div className="page">
      <div className="folio">
        <h1 className="t-display">Library</h1>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ mode: "new" })}>
          Add reference
        </button>
      </div>

      <BuiltinShelf />
      <h2 className="t-heading">Your saved references</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "end", marginBottom: "2rem" }}>
        <div className="field" style={{ flex: "1 1 16rem", maxWidth: "24rem" }}>
          <label htmlFor="lib-q">Search titles, tags and credits</label>
          <input id="lib-q" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {collections.length ? (
          <div className="field" style={{ minWidth: "12rem" }}>
            <label htmlFor="lib-col">Collection</label>
            <select id="lib-col" className="select" value={col} onChange={(e) => setCol(e.target.value)}>
              <option value="">All collections</option>
              {collections.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="modes" role="toolbar" aria-label="Category" style={{ flexWrap: "wrap", marginBottom: "2rem" }}>
        {(["All", ...REFERENCE_CATEGORIES] as const).map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {data.status === "loading" ? <p className="t-meta">Opening the library…</p> : null}
      {data.status === "error" ? (
        <p className="notice" data-tone="error" role="alert">
          {data.message}
        </p>
      ) : null}
      {data.status === "ready" && refs.length === 0 ? (
        <div style={{ display: "grid", gap: "1rem", maxWidth: "40rem" }}>
          <p className="prose-serif">Keep the work that taught you something: a link, a screenshot you&apos;re allowed to keep, and a note on why it works.</p>
          <p className="t-meta">References are organised by category and collection, and their images can be sent to the analyzer.</p>
        </div>
      ) : null}
      {data.status === "ready" && refs.length > 0 && filtered.length === 0 ? <p className="t-meta">Nothing matches these filters.</p> : null}

      <ul className="sheet-grid" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="References">
        {filtered.map((r) => {
          const a = r.assetId ? assets.get(r.assetId) : undefined;
          return (
            <li key={r.id}>
              <button type="button" className="frame" onClick={() => setDialog({ mode: "view", id: r.id })} data-testid="reference-frame">
                <span className="frame-img">{a ? <Thumb blob={a.thumb} alt="" /> : <span className="link-card">{r.title}</span>}</span>
                <span className="frame-title t-subhead" style={{ overflowWrap: "anywhere" }}>
                  {r.title}
                </span>
                <span className="t-small">
                  {r.category}
                  {r.collection ? `, ${r.collection}` : ""}
                </span>
                {r.tags.length ? (
                  <span>
                    {r.tags.slice(0, 4).map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog.Root
        open={!!dialog}
        onOpenChange={(o) => {
          if (!o) {
            if (dialog?.mode === "new" || dialog?.mode === "edit") closeRef.current?.();
            else setDialog(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="overlay" />
          <Dialog.Content className="dialog" aria-describedby={undefined}>
            <Dialog.Title className="t-heading">
              {dialog?.mode === "new" ? "Add reference" : dialog?.mode === "edit" ? "Edit reference" : (active?.title ?? "Reference")}
            </Dialog.Title>
            {dialog?.mode === "new" ? <Editor closeRef={closeRef} initial={EMPTY} collections={collections} onDone={() => setDialog(null)} /> : null}
            {dialog?.mode === "edit" && active ? (
              <Editor
                closeRef={closeRef}
                initial={{
                  id: active.id,
                  title: active.title,
                  url: active.url,
                  attribution: active.attribution,
                  category: active.category,
                  tags: active.tags.join(", "),
                  collection: active.collection,
                  notes: active.notes,
                  assetId: active.assetId,
                }}
                collections={collections}
                onDone={() => setDialog({ mode: "view", id: active.id })}
              />
            ) : null}
            {dialog?.mode === "view" && active ? (
              <Detail
                item={active}
                asset={active.assetId ? assets.get(active.assetId) : undefined}
                onEdit={() => setDialog({ mode: "edit", id: active.id })}
                onClose={() => setDialog(null)}
              />
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
