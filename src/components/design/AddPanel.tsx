"use client";

import { useMemo, useState } from "react";
import { cssFamily, measureText } from "@/lib/design/browser";
import type { Item, Licence } from "@/lib/design/library";
import { renderSvg } from "@/lib/design/render";
import { DESIGN_SCHEMA, DESIGN_VERSION, type DesignDoc } from "@/lib/design/schema";

export type StarterKind = "text" | "rect" | "ellipse" | "line" | "image";
export type ResourceCard = { id: string; name: string; url: string | null; licence: Licence; kind: "image" | "font" };

type Props = {
  items: Item[];
  images: ResourceCard[];
  fonts: ResourceCard[];
  onStarter: (kind: StarterKind) => void;
  onItem: (item: Item) => void;
  onImage: (resourceId: string) => void;
  onAddResource: (file: File, kind: "image" | "font", meta: { name: string; licence: Licence }) => Promise<void>;
  fontsVersion: number;
};

const KIND_LABEL: Record<Item["kind"], string> = { type: "Type", shape: "Shapes", frame: "Frames", mark: "Marks", info: "Information" };

function ItemPreview({ item, fontsVersion }: { item: Item; fontsVersion: number }) {
  const svg = useMemo(() => {
    const doc: DesignDoc = {
      schema: DESIGN_SCHEMA,
      version: DESIGN_VERSION,
      id: item.id,
      name: item.name,
      width: Math.max(64, Math.ceil(item.width)),
      height: Math.max(64, Math.ceil(item.height)),
      background: "#ffffff",
      layers: item.layers,
      templateId: null,
      projectId: null,
      createdAt: 0,
      updatedAt: 0,
    };
    return renderSvg(doc, { measure: measureText, fontFamily: cssFamily, placeholders: true, idPrefix: item.id }).replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%" ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, fontsVersion]);
  return <span className="design-item-preview" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function AddResourceForm({ kind, onAdd }: { kind: "image" | "font"; onAdd: Props["onAddResource"] }) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [licence, setLicence] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = kind === "image" ? "image" : "font";
  return (
    <form
      className="design-resource-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
          await onAdd(file, kind, {
            name: file.name.slice(0, 200),
            licence: { id: licence.trim() || "Not recorded", author: author.trim() || "Not recorded", source: source.trim() || "Not recorded" },
          });
          setFile(null);
          setSource("");
          setLicence("");
          setAuthor("");
          (e.target as HTMLFormElement).reset();
        } catch (err) {
          setError(err instanceof Error ? err.message : `The ${label} couldn't be added.`);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="field">
        <label htmlFor={`add-${kind}`}>{kind === "image" ? "Add your image" : "Add your font"}</label>
        <input
          id={`add-${kind}`}
          type="file"
          accept={kind === "image" ? "image/png,image/jpeg,image/webp,image/gif" : ".ttf,.otf,.woff,.woff2"}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <span className="hint">{kind === "image" ? "PNG, JPEG, WebP or GIF, up to 15 MB." : "TTF, OTF, WOFF or WOFF2, up to 10 MB."} Kept in this browser.</span>
      </div>
      {file ? (
        <>
          <div className="field">
            <label htmlFor={`src-${kind}`}>Where it&rsquo;s from</label>
            <input id={`src-${kind}`} className="input" value={source} maxLength={300} placeholder="Link or “my own photo”" onChange={(e) => setSource(e.target.value)} />
          </div>
          <div className="design-row">
            <div className="field">
              <label htmlFor={`by-${kind}`}>Made by</label>
              <input id={`by-${kind}`} className="input" value={author} maxLength={120} onChange={(e) => setAuthor(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`lic-${kind}`}>Licence</label>
              <input id={`lic-${kind}`} className="input" value={licence} maxLength={40} placeholder={kind === "font" ? "OFL-1.1" : "Own work"} onChange={(e) => setLicence(e.target.value)} />
            </div>
          </div>
          <p className="hint">FrameProof records what you enter and shows it on export. It doesn&rsquo;t check licences.</p>
          <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
            {busy ? "Adding…" : `Add ${label} to your library`}
          </button>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function AddPanel({ items, images, fonts, onStarter, onItem, onImage, onAddResource, fontsVersion }: Props) {
  const groups = useMemo(() => {
    const m = new Map<Item["kind"], Item[]>();
    for (const it of items) m.set(it.kind, [...(m.get(it.kind) ?? []), it]);
    return [...m];
  }, [items]);
  return (
    <section className="design-panel" aria-labelledby="add-h">
      <h2 id="add-h" className="t-subhead">
        Add
      </h2>
      <div className="design-row design-starters">
        <button type="button" className="btn btn-sm" onClick={() => onStarter("text")}>
          Text
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onStarter("rect")}>
          Rectangle
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onStarter("ellipse")}>
          Ellipse
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onStarter("line")}>
          Rule
        </button>
        <button type="button" className="btn btn-sm" onClick={() => onStarter("image")}>
          Image slot
        </button>
      </div>

      {groups.length ? <h3 className="t-meta design-sub">Items</h3> : null}
      {groups.map(([kind, list]) => (
        <div key={kind} className="design-item-group">
          <p className="hint">{KIND_LABEL[kind]}</p>
          <ul className="design-items">
            {list.map((it) => (
              <li key={it.id}>
                <button type="button" className="design-item" onClick={() => onItem(it)} aria-label={`Add item: ${it.name}`}>
                  <ItemPreview item={it} fontsVersion={fontsVersion} />
                  <span className="t-small">{it.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h3 className="t-meta design-sub">Your images</h3>
      {images.length ? (
        <ul className="design-items">
          {images.map((r) => (
            <li key={r.id}>
              <button type="button" className="design-item" onClick={() => onImage(r.id)} aria-label={`Place image: ${r.name}`} title={`${r.licence.id} · ${r.licence.source}`}>
                <span className="design-item-preview">{/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL, nothing for next/image to optimise */}
                  {r.url ? <img src={r.url} alt="" /> : null}</span>
                <span className="t-small">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">None yet. Your pictures fill image slots; FrameProof never generates images.</p>
      )}
      <AddResourceForm kind="image" onAdd={onAddResource} />

      <h3 className="t-meta design-sub">Your fonts</h3>
      {fonts.length ? (
        <ul className="design-font-list">
          {fonts.map((f) => (
            <li key={f.id}>
              {f.name} <span className="hint">{f.licence.id}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Seven OFL families are built in. Add a font file you&rsquo;re licensed to use.</p>
      )}
      <AddResourceForm kind="font" onAdd={onAddResource} />
    </section>
  );
}
