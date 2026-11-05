"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DesignPreview } from "@/components/design/DesignPreview";
import { toast } from "@/components/Toast";
import { withBase } from "@/lib/base-path";
import { BUILTIN_FONTS, type BuiltinFontId } from "@/lib/design/fonts";
import { cssFamily } from "@/lib/design/browser";
import { STARTERS, starterDoc } from "@/lib/design/starters";
import { DesignDocSchema } from "@/lib/design/schema";
import { addResource, saveNewDesign } from "@/lib/store/repo";
import { LIBRARY_ART, INSPIRATION_SOURCES } from "@/lib/library/catalogue";

const tabs = ["Templates", "Artwork", "Fonts", "Sources"] as const;
type Tab = (typeof tabs)[number];
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))", gap: "1.5rem", listStyle: "none", padding: 0 } as const;
const card = { display: "grid", gap: ".6rem", alignContent: "start", minWidth: 0 } as const;

/** Bundled resources exist on a first visit; user references below remain a separate collection. */
export function BuiltinShelf() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Templates");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const needle = query.trim().toLowerCase();
  const matches = (...s: string[]) => !needle || s.join(" ").toLowerCase().includes(needle);
  const docs = useMemo(() => STARTERS.map((s) => starterDoc(s, `lib-${s.id}`, 0)), []);
  const start = async (fn: () => Promise<ReturnType<typeof DesignDocSchema.parse>>) => {
    setBusy(true);
    try { const saved = await saveNewDesign(await fn()); router.push(`/design?id=${encodeURIComponent(saved.id)}`); }
    catch (e) { toast(e instanceof Error ? e.message : "The design couldn't be opened."); setBusy(false); }
  };
  const openArtwork = (art: (typeof LIBRARY_ART)[number]) => start(async () => {
    let id = art.id;
    if (!art.builtin) {
      const response = await fetch(withBase(art.file));
      if (!response.ok) throw new Error("This artwork couldn't be loaded. Try again.");
      const resource = await addResource(await response.blob(), "image", { name: art.title, licence: { id: art.licence, author: art.author.slice(0,120), source: art.source }, tags: ["public domain", "library pack"] });
      id = resource.id;
    }
    return DesignDocSchema.parse({ schema: "frameproof.design", version: 1, id: "new", name: art.title.slice(0,120), width: art.width, height: art.height, background: "#f6f4ef", layers: [{ id: "artwork", name: "Artwork", type: "image", role: "photo", x: 0, y: 0, w: art.width, h: art.height, resourceId: id, fit: "contain" }], createdAt: Date.now(), updatedAt: Date.now() });
  });

  const templates = STARTERS.map((s, i) => ({ s, doc: docs[i]! })).filter(({ s }) => matches(s.template.name, s.template.concept, s.template.idea));
  const art = LIBRARY_ART.filter((a) => matches(a.title, a.author, "art painting public domain botanical print CC0"));
  const fonts = (Object.entries(BUILTIN_FONTS) as Array<[BuiltinFontId, (typeof BUILTIN_FONTS)[BuiltinFontId]]>).filter(([, f]) => matches(f.label, "font Vietnamese English OFL typography chữ"));
  const sources = INSPIRATION_SOURCES.filter((s) => matches(s.name, s.topic, s.note));
  const count = { Templates: templates.length, Artwork: art.length, Fonts: fonts.length, Sources: sources.length }[tab];

  return <section aria-labelledby="builtin-library-heading" data-testid="builtin-library" style={{ marginBottom: "3rem" }}>
    <h2 id="builtin-library-heading" className="t-heading">Ready to design</h2>
    <p className="t-meta">{STARTERS.length} editable book covers, infographics and posters, {LIBRARY_ART.length} public-domain artworks and {Object.keys(BUILTIN_FONTS).length} Vietnamese–English font families are included. Open a template or start with an artwork; no upload is needed.</p>
    <div className="modes" role="toolbar" aria-label="Built-in resource type" style={{ flexWrap: "wrap", margin: "1rem 0" }}>
      {tabs.map((t) => <button key={t} type="button" aria-pressed={t === tab} onClick={() => setTab(t)}>{t}</button>)}
    </div>
    <div className="field" style={{ maxWidth: "30rem", marginBottom: "1.5rem" }}><label htmlFor="builtin-search">Search built-in resources</label><input id="builtin-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Botanical, collage, Cormorant…" /></div>
    <p className="t-small" role="status">{count} {tab.toLowerCase()}{needle ? " match your search" : " available"}</p>
    {count === 0 ? <p className="notice">No matches in {tab.toLowerCase()}. Try another resource type or clear the search.</p> : null}
    {tab === "Templates" ? <ul style={grid} aria-label="Built-in templates">{templates.map(({ s, doc }) => <li key={s.id} style={card}>
      <button type="button" className="design-card" disabled={busy} onClick={() => start(async () => starterDoc(s,"new"))} aria-label={`Open editable template: ${s.template.name}`}><DesignPreview doc={doc}/><span className="t-subhead">{s.template.name}</span></button>
      <p className="t-small">{s.template.idea}</p><span className="hint">{s.template.layers.length} editable layers · {s.template.licence.id}</span>
    </li>)}</ul> : null}
    {tab === "Artwork" ? <><ul style={grid} aria-label="Bundled artwork">{art.map((a) => <li key={a.id} style={card}>
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled JPEG; lazy-loaded only in this shelf */}
      <img src={withBase(a.file)} alt={a.title} width={a.width} height={a.height} loading="lazy" decoding="async" style={{ width:"100%",height:"14rem",objectFit:"contain",background:"var(--color-paper)" }}/>
      <h3 className="t-subhead">{a.title}</h3><p className="t-small">{a.author} · {a.date}</p><span className="hint">{a.width} × {a.height} px · CC0-1.0</span>
      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => openArtwork(a)}>Design with this image</button>
      <div className="design-row"><a href={withBase(a.file)} download>Download JPEG</a><a href={a.source} target="_blank" rel="noopener noreferrer">Museum source</a></div>
    </li>)}</ul><p className="hint">Sources, checksums and original-file links: <a href={withBase("/library-pack/manifest.json")}>downloaded pack manifest</a> · <a href={withBase("/art/manifest.json")}>original artwork manifest</a>.</p></> : null}
    {tab === "Fonts" ? <><ul style={grid} aria-label="Bundled fonts">{fonts.map(([id,f]) => <li key={id} style={{ ...card, borderTop:"1px solid var(--color-line)",paddingTop:"1rem" }}><h3 className="t-subhead">{f.label}</h3><p style={{ fontFamily:cssFamily(id),fontSize:"1.8rem",lineHeight:1.3 }}>Dạ hành khúc<br/>A new chapter</p><span className="hint">Self-hosted · Vietnamese + English · OFL-1.1</span><a href={withBase(`/fonts/${f.files[0].file}`)} download>Download font</a><a href={`https://${f.source.replace(" (", "/tree/main/").replace(")", "")}`} target="_blank" rel="noopener noreferrer">Font source</a></li>)}</ul><p className="hint">Fonts are ready in every editor font menu. Downloaded font files retain their original OFL terms; check the source licence before redistribution.</p></> : null}
    {tab === "Sources" ? <><p className="t-meta">Your inspiration sources, kept as bookmarks. These links are separate from the downloadable, licensed resources above.</p><ul style={grid} aria-label="Design inspiration sources">{sources.map((s) => <li key={s.url} style={{ ...card,borderTop:"1px solid var(--color-line)",paddingTop:"1rem" }}><h3 className="t-subhead"><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></h3><p>{s.topic}</p><p className="hint">{s.note}</p></li>)}</ul></> : null}
    <hr className="rule"/>
  </section>;
}
