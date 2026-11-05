"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PaletteEditor } from "@/components/design/PaletteEditor";
import { useDraftGuard } from "@/components/ConfirmDialog";
import { toast } from "@/components/Toast";
import { useAiStatus } from "@/hooks/useAiStatus";
import { useObjectUrl, useStore } from "@/hooks/useStore";
import { useObjectUrls } from "@/hooks/useObjectUrls";
import { BUILTIN_ART, getBuiltinArt } from "@/lib/design/art";
import { cssFamily, loadDocFonts, measureText } from "@/lib/design/browser";
import { composeConcepts, type Concept } from "@/lib/design/compose";
import { COLOUR_ROLES, DEFAULT_PALETTE, directionFromAnswer, paletteFromMeasured, type ArtDirection, type Brief, type ColourRole, type Swatch } from "@/lib/design/direction";
import { artUrl } from "@/lib/design/exporters";
import { BUILTIN_FONT_IDS, BUILTIN_FONTS, type BuiltinFontId } from "@/lib/design/fonts";
import { TEMPLATE_CONCEPTS, type Template } from "@/lib/design/library";
import { renderSvg } from "@/lib/design/render";
import { TEMPLATES } from "@/lib/design/templates";
import { STYLE_PRESETS } from "@/lib/styles/presets";
import { decodeAndAnalyze } from "@/lib/image/decode";
import { newId } from "@/lib/store/db";
import { addResource, listResources, saveNewDesign } from "@/lib/store/repo";
import { requestAiDirection, type AiDirectionResult } from "./ai-direction";

type Ref = { id: string; name: string; file: Blob; swatches: Array<{ hex: string; share: number; chroma: number }> };

const CONCEPT_LABEL: Record<Template["concept"], string> = {
  exhibition: "Exhibition",
  "type-as-image": "Type as image",
  "editorial-cover": "Editorial cover",
  music: "Music",
  collage: "Collage",
  event: "Event",
};
const ROLE_LABEL: Record<ColourRole, string> = { ground: "Ground", ink: "Ink", accent: "Accent", support: "Support" };
const ORIGIN_LABEL = { measured: "measured", manual: "your choice", "ai-suggested": "AI suggestion" } as const;

function ConceptPreview({ concept, urls, fontsVersion }: { concept: Concept; urls: Map<string, string>; fontsVersion: number }) {
  const svg = useMemo(
    () =>
      renderSvg(concept.doc, {
        measure: measureText,
        fontFamily: cssFamily,
        image: (id) => urls.get(id) ?? (getBuiltinArt(id) ? artUrl(getBuiltinArt(id)!) : null),
        placeholders: true,
        idPrefix: concept.doc.id,
      }).replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block" '),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [concept, urls, fontsVersion],
  );
  return <span className="design-card-preview" style={{ aspectRatio: `${concept.doc.width} / ${concept.doc.height}` }} role="img" aria-label={`Concept preview: ${concept.doc.name}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ReferenceImage({ file, name }: { file: Blob; name: string }) {
  const url = useObjectUrl(file);
  // eslint-disable-next-line @next/next/no-img-element -- local Blob URL, released on removal or navigation
  return url ? <img src={url} alt={`Reference: ${name}`} /> : null;
}

export function Composer() {
  const router = useRouter();
  const search = useSearchParams();
  const preset = STYLE_PRESETS.find((p) => p.id === search.get("stylePreset"));
  const ai = useAiStatus();
  const lib = useStore(() => listResources("image"), ["resources"]);
  const userImages = useMemo(() => (lib.status === "ready" ? lib.data : []), [lib]);
  const urls = useObjectUrls(userImages);

  const [refs, setRefs] = useState<Ref[]>([]);
  const [refError, setRefError] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief>({ title: "", subtitle: "", lines: [], intent: preset?.principles.join("\n") ?? "" });
  const [linesText, setLinesText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [useArt, setUseArt] = useState<string[]>([]);
  const [palette, setPalette] = useState<Swatch[]>(() => preset ? preset.colours.map((hex, i) => ({ hex, role: COLOUR_ROLES[i]!, origin: "manual" })) : DEFAULT_PALETTE);
  const [fonts, setFonts] = useState<ArtDirection["fonts"]>({ display: preset?.display ?? "anton", text: preset?.body ?? "archivo", origin: "manual" });
  const [concepts, setConcepts] = useState<ArtDirection["concepts"]>(["exhibition", "editorial-cover", "music", "collage"]);
  const [conceptsOrigin, setConceptsOrigin] = useState<ArtDirection["conceptsOrigin"]>("manual");
  const [aiResult, setAiResult] = useState<AiDirectionResult | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [results, setResults] = useState<Concept[] | null>(null);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [saving, setSaving] = useState<number | null>(null);

  const dirty = !!(brief.title || linesText || refs.length);
  const guard = useDraftGuard(dirty && saving === null);

  const addRefs = async (files: FileList | null) => {
    setRefError(null);
    for (const file of Array.from(files ?? []).slice(0, 3 - refs.length)) {
      try {
        const d = await decodeAndAnalyze(file);
        const ref: Ref = { id: newId("ref"), name: file.name, file, swatches: d.analysis.palette.swatches.map((s) => ({ hex: s.hex, share: s.share, chroma: s.chroma })) };
        setRefs((r) => {
          const next = [...r, ref];
          // The palette follows the references until the user edits it.
          if (palette.every((s) => s.origin !== "manual" || DEFAULT_PALETTE.some((d) => d.hex === s.hex))) {
            const merged = next.flatMap((x) => x.swatches.map((s) => ({ ...s, share: s.share / next.length })));
            const measured = paletteFromMeasured(merged.sort((a, b) => b.share - a.share));
            if (measured.length >= 2) setPalette(measured);
          }
          return next;
        });
      } catch (e) {
        setRefError(e instanceof Error ? e.message : `${file.name} couldn't be read.`);
      }
    }
  };

  const pictures = [...picked.map((id) => ({ id })), ...useArt.map((id) => ({ id }))];
  const direction: ArtDirection = { palette, fonts, concepts, conceptsOrigin, notes: aiResult?.notes ?? "" };
  const canCompose = brief.title.trim().length > 0 && palette.length >= 2;

  const compose = async (choices?: AiDirectionResult, dir: ArtDirection = direction) => {
    const lines = linesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 8);
    const b: Brief = { ...brief, title: brief.title.trim(), lines };
    const out = composeConcepts({
      brief: b,
      direction: dir,
      pictures,
      templates: TEMPLATES,
      measure: measureText,
      choices: choices?.concepts.map((c) => ({ templateId: c.templateId, photoOrder: c.photoOrder, note: c.note })),
      model: choices?.model,
    });
    await Promise.all(out.map((c) => loadDocFonts(c.doc)));
    // Re-compose once real font metrics are in, so text fitting uses them.
    const fitted = composeConcepts({
      brief: b,
      direction: dir,
      pictures,
      templates: TEMPLATES,
      measure: measureText,
      choices: choices?.concepts.map((c) => ({ templateId: c.templateId, photoOrder: c.photoOrder, note: c.note })),
      model: choices?.model,
    });
    setResults(fitted);
    setFontsVersion((v) => v + 1);
    requestAnimationFrame(() => document.getElementById("concepts")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  };

  const askAi = async () => {
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await requestAiDirection({
        refs: refs.map((r) => r.file),
        brief: { ...brief, lines: linesText.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8) },
        allowed: { fontIds: [...BUILTIN_FONT_IDS], templateIds: TEMPLATES.map((t) => t.id), imageIds: pictures.map((p) => p.id) },
      });
      // Compose from the AI's direction itself; the state set here is only read on the next render.
      const next = directionFromAnswer(result, concepts);
      setAiResult(result);
      setPalette(next.palette);
      setFonts(next.fonts);
      setConceptsOrigin("ai-suggested");
      await compose(result, next);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "The AI direction failed.");
    } finally {
      setAiBusy(false);
    }
  };

  const open = async (i: number, all = false) => {
    if (!results) return;
    setSaving(i);
    try {
      const list = all ? results : [results[i]!];
      const saved = [];
      for (const c of list) saved.push(await saveNewDesign(c.doc));
      toast(all ? "Three concepts saved to your designs." : "Concept saved to your designs.");
      router.push(all ? "/design" : `/design?id=${encodeURIComponent(saved[0]!.id)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "The concept couldn't be saved.");
      setSaving(null);
    }
  };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const fontOptions = BUILTIN_FONT_IDS.map((f) => ({ id: f, label: BUILTIN_FONTS[f].label }));

  return (
    <div className="page compose">
      {guard.dialog}
      <header className="folio">
        <h1 className="t-title">Compose a concept</h1>
        {preset ? <p className="notice">Starting with {preset.name}: its palette and fonts are selected below. You can change every choice.</p> : null}
        <p className="t-meta">References and a brief in; three editable designs out. Nothing is generated: concepts are built from templates, items, your pictures and public-domain art.</p>
      </header>

      <ol className="compose-steps">
        <li className="compose-step" aria-labelledby="s1">
          <h2 id="s1" className="t-heading">
            <span className="compose-n">1</span> References
          </h2>
          <p className="t-meta">Up to three images whose look you want to follow. Their palette is measured here, in your browser.</p>
          <div className="compose-refs">
            {refs.map((r) => (
              <figure key={r.id} className="compose-ref">
                <ReferenceImage file={r.file} name={r.name} />
                <figcaption className="t-small">
                  {r.name}{" "}
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => setRefs((x) => x.filter((y) => y.id !== r.id))}>
                    Remove
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          {refs.length < 3 ? (
            <div className="field">
              <label htmlFor="refs">Add reference images</label>
              <input id="refs" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void addRefs(e.target.files)} />
              <span className="hint">PNG, JPEG, WebP or GIF, up to 15 MB each. References aren&rsquo;t placed in the design unless you also pick them as pictures.</span>
            </div>
          ) : null}
          {refError ? (
            <p role="alert" className="error-text">
              {refError}
            </p>
          ) : null}
        </li>

        <li className="compose-step" aria-labelledby="s2">
          <h2 id="s2" className="t-heading">
            <span className="compose-n">2</span> Brief
          </h2>
          <div className="compose-grid">
            <div className="field">
              <label htmlFor="b-title">Title</label>
              <input id="b-title" className="input" value={brief.title} maxLength={120} placeholder="Triển lãm Gốm Bát Tràng" onChange={(e) => setBrief({ ...brief, title: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="b-sub">Subtitle (optional)</label>
              <input id="b-sub" className="input" value={brief.subtitle} maxLength={200} onChange={(e) => setBrief({ ...brief, subtitle: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="b-lines">Information, one line each</label>
              <textarea id="b-lines" className="textarea" value={linesText} placeholder={"12–30 / Tháng Mười / 2026\nBảo tàng Mỹ thuật Việt Nam\n66 Nguyễn Thái Học, Hà Nội"} onChange={(e) => setLinesText(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="b-intent">Intent (optional)</label>
              <textarea id="b-intent" className="textarea" value={brief.intent} maxLength={600} placeholder="Quiet, museum-like; the clay colour should lead." onChange={(e) => setBrief({ ...brief, intent: e.target.value })} />
              <span className="hint">Only the AI direction reads this. The template composer uses title, subtitle and lines.</span>
            </div>
          </div>
        </li>

        <li className="compose-step" aria-labelledby="s3">
          <h2 id="s3" className="t-heading">
            <span className="compose-n">3</span> Pictures
          </h2>
          <p className="t-meta">Pick the pictures to place, in order. Empty picture slots stay as slots you can fill later.</p>
          <h3 className="t-meta design-sub">Your images</h3>
          {userImages.length ? (
            <ul className="design-items compose-picks">
              {userImages.map((r) => (
                <li key={r.id}>
                  <button type="button" className="design-item" aria-pressed={picked.includes(r.id)} onClick={() => setPicked((p) => toggle(p, r.id))}>
                    <span className="design-item-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
                      <img src={urls.get(r.id)} alt="" />
                    </span>
                    <span className="t-small">
                      {picked.includes(r.id) ? `${picked.indexOf(r.id) + 1}. ` : ""}
                      {r.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="field">
            <label htmlFor="pics">Add your pictures</label>
            <input
              id="pics"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async (e) => {
                for (const f of Array.from(e.target.files ?? [])) {
                  try {
                    const r = await addResource(f, "image", { name: f.name, licence: { id: "Not recorded", author: "Not recorded", source: "Added in Compose" } });
                    setPicked((p) => [...p, r.id]);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : `${f.name} couldn't be added.`);
                  }
                }
              }}
            />
            <span className="hint">Saved to your library in this browser. Record source and licence in the editor&rsquo;s Add panel.</span>
          </div>
          <h3 className="t-meta design-sub">Public-domain art (The Met, CC0)</h3>
          <ul className="design-items compose-picks">
            {BUILTIN_ART.map((a) => (
              <li key={a.id}>
                <button type="button" className="design-item" aria-pressed={useArt.includes(a.id)} onClick={() => setUseArt((p) => toggle(p, a.id))} title={`${a.author}, ${a.title}, ${a.date}`}>
                  <span className="design-item-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static public-domain file */}
                    <img src={artUrl(a)} alt="" loading="lazy" />
                  </span>
                  <span className="t-small">{a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </li>

        <li className="compose-step" aria-labelledby="s4">
          <h2 id="s4" className="t-heading">
            <span className="compose-n">4</span> Direction
          </h2>
          <PaletteEditor
            heading={refs.length ? "Palette (from your references)" : "Palette"}
            entries={palette.map((s) => ({ hex: s.hex, label: ROLE_LABEL[s.role], detail: `${ORIGIN_LABEL[s.origin]}${s.share !== undefined ? `, ${Math.round(s.share * 100)}% of the references` : ""}` }))}
            onChange={(hexes) => setPalette((p) => p.map((s, i) => (hexes[i] && hexes[i] !== s.hex ? { ...s, hex: hexes[i]!, origin: "manual", share: undefined } : s)))}
            renderExtra={(i) => (
              <div className="design-row">
                <div className="field">
                  <label htmlFor={`role-${i}`}>Role</label>
                  <select id={`role-${i}`} className="select" value={palette[i]!.role} onChange={(e) => setPalette((p) => p.map((s, j) => (j === i ? { ...s, role: e.target.value as ColourRole } : s)))}>
                    {COLOUR_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="btn btn-sm btn-quiet" disabled={palette.length <= 2} onClick={() => setPalette((p) => p.filter((_, j) => j !== i))}>
                  Remove colour
                </button>
              </div>
            )}
          />
          <p className="hint">
            {palette.some((s) => s.origin === "measured") ? "Colours marked measured come from your references' pixels; roles are a rule you can change. " : ""}
            Fonts and layout can&rsquo;t be measured from pixels, so you choose them{ai.state === "on" ? " or ask the AI for a suggestion" : ""}.
          </p>
          <div className="design-row">
            {(["display", "text"] as const).map((k) => (
              <div className="field" key={k}>
                <label htmlFor={`font-${k}`}>{k === "display" ? "Display font (titles)" : "Text font (information)"}</label>
                <select id={`font-${k}`} className="select" value={fonts[k] as string} onChange={(e) => setFonts({ ...fonts, [k]: e.target.value as BuiltinFontId, origin: "manual" })}>
                  {fontOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <span className="compose-specimen" style={{ fontFamily: cssFamily(fonts[k]) }}>
                  Triển lãm · Đêm nhạc · Bìa sách
                </span>
              </div>
            ))}
          </div>
          {fonts.origin === "ai-suggested" ? <p className="hint">Fonts: AI suggestion.</p> : null}
          <fieldset className="compose-concepts">
            <legend className="label">Concept families, in order of preference</legend>
            {TEMPLATE_CONCEPTS.filter((c) => TEMPLATES.some((t) => t.concept === c)).map((c) => (
              <label key={c} className="design-check">
                <input
                  type="checkbox"
                  checked={concepts.includes(c)}
                  onChange={() => {
                    setConceptsOrigin("manual");
                    setConcepts((x) => (x.includes(c) ? (x.length > 1 ? x.filter((y) => y !== c) : x) : [...x, c]));
                  }}
                />
                {CONCEPT_LABEL[c]}
                {concepts.includes(c) ? <span className="hint"> ({concepts.indexOf(c) + 1})</span> : null}
              </label>
            ))}
          </fieldset>
        </li>
      </ol>

      <div className="compose-actions">
        <button type="button" className="btn btn-primary" disabled={!canCompose} onClick={() => void compose()}>
          Compose three concepts
        </button>
        {ai.state === "on" ? (
          <button type="button" className="btn" disabled={!canCompose || !refs.length || aiBusy} onClick={() => void askAi()}>
            {aiBusy ? "Asking the AI…" : "Ask AI for a direction"}
          </button>
        ) : (
          <span className="hint">{ai.state === "loading" ? "" : "AI direction is off on this server (no key configured). The template composer works without it."}</span>
        )}
        {!brief.title.trim() ? <span className="hint">Add a title to compose.</span> : null}
        {ai.state === "on" && !refs.length ? <span className="hint">The AI direction needs at least one reference.</span> : null}
      </div>
      {aiError ? (
        <p role="alert" className="notice" data-tone="error">
          {aiError} Nothing was changed; the template composer still works.
        </p>
      ) : null}

      {results ? (
        <section id="concepts" aria-labelledby="concepts-h" className="compose-results">
          <h2 id="concepts-h" className="t-heading">
            Three concepts
          </h2>
          {aiResult ? <p className="t-meta">AI direction ({aiResult.model}): {aiResult.notes}</p> : null}
          <ul className="compose-result-list" data-testid="concepts">
            {results.map((c, i) => (
              <li key={c.doc.id} className="compose-result" style={{ animationDelay: `${i * 60}ms` }}>
                <ConceptPreview concept={c} urls={urls} fontsVersion={fontsVersion} />
                <p className="t-subhead">Concept {i + 1}</p>
                <p className="evidence" data-type={c.method.kind === "ai-directed" ? "ai-observed" : "estimated"}>
                  {c.method.kind === "ai-directed" ? `AI-directed, built from a template` : "Composed from a template"}
                </p>
                <ul className="t-small compose-notes">
                  {c.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <button type="button" className="btn btn-sm btn-primary" disabled={saving !== null} onClick={() => void open(i)}>
                  {saving === i ? "Opening…" : "Edit this concept"}
                </button>
              </li>
            ))}
          </ul>
          <div className="compose-actions">
            <button type="button" className="btn" disabled={saving !== null} onClick={() => void open(0, true)}>
              Save all three to Designs
            </button>
            <Link href="/design" className="btn btn-quiet">
              Go to Designs
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
