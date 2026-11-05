"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useExportAccess } from "@/components/ExportAccess";
import { useDraftGuard } from "@/components/ConfirmDialog";
import { AddPanel, type ResourceCard, type StarterKind } from "@/components/design/AddPanel";
import { Canvas } from "@/components/design/Canvas";
import { Inspector } from "@/components/design/Inspector";
import { LayersPanel } from "@/components/design/LayersPanel";
import { useHistory } from "@/components/design/useHistory";
import { DocPalette } from "@/components/design/DocPalette";
import { CutoutDialog, type CutoutSource } from "@/components/design/CutoutDialog";
import { InpaintDialog } from "@/components/design/InpaintDialog";
import type { ToolResult } from "@/lib/image-tools/types";
import { toast } from "@/components/Toast";
import { useStore } from "@/hooks/useStore";
import { useObjectUrls } from "@/hooks/useObjectUrls";
import { loadDocFonts, registerUserFont } from "@/lib/design/browser";
import { addLayer, duplicateLayer, hitTest, moveLayer, removeLayer, starterLayer, updateLayer } from "@/lib/design/edit";
import { BUILTIN_ART, getBuiltinArt, isBuiltinArt } from "@/lib/design/art";
import { artUrl, designBundle, designPng, designSvg, missingMessage } from "@/lib/design/exporters";
import { ITEMS } from "@/lib/design/items";
import { placeItem, type Item } from "@/lib/design/library";
import type { Resource } from "@/lib/design/resource";
import { referencedResources, type DesignDoc, type Layer } from "@/lib/design/schema";
import { newId } from "@/lib/store/db";
import { addResource, getDesign, listResources, saveDesign, sendDesignToReview } from "@/lib/store/repo";

type Tab = "edit" | "layers" | "add";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileName = (doc: DesignDoc) => doc.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60) || "design";

export function DesignEditor({ id, at }: { id: string; at: { x: number; y: number } | null }) {
  const design = useStore(() => getDesign(id), ["designs"], [id]);
  const resources = useStore(() => listResources(), ["resources"]);
  if (design.status === "loading" || resources.status === "loading") return <div className="busy-line" aria-label="Loading the design" />;
  if (design.status === "error" || resources.status === "error")
    return (
      <p className="notice" data-tone="error">
        {design.status === "error" ? design.message : resources.status === "error" ? resources.message : ""}
      </p>
    );
  if (!design.data)
    return (
      <div className="page">
        <p className="notice" data-tone="error">
          This design isn&rsquo;t in this browser. It may have been deleted, or made in another browser.
        </p>
        <p style={{ marginTop: "1rem" }}>
          <Link className="link" href="/design">
            Back to designs
          </Link>
        </p>
      </div>
    );
  return <LoadedEditor key={id} initial={design.data} resources={resources.data} at={at} />;
}

function LoadedEditor({ initial, resources, at }: { initial: DesignDoc; resources: Resource[]; at: { x: number; y: number } | null }) {
  const router = useRouter();
  const withExportAccess = useExportAccess();
  const h = useHistory<DesignDoc>(initial);
  const doc = h.present;
  const [selectedId, setSelectedId] = useState<string | null>(() => (at ? (hitTest(initial, at.x * initial.width, at.y * initial.height, { includeLocked: true })?.id ?? null) : null));
  const [tab, setTab] = useState<Tab>("edit");
  const [fontsVersion, setFontsVersion] = useState(0);
  // Palette before/after: the design as it was before the first palette change in this session.
  const [before, setBefore] = useState<DesignDoc | null>(null);
  const [comparing, setComparing] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved" | "failed">("saved");
  const [busy, setBusy] = useState<string | null>(null);
  const saved = useRef<DesignDoc>(initial);
  const projectId = useRef<string | null>(initial.projectId);
  const [linked, setLinked] = useState(initial.projectId !== null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // Background removal for one picture layer: which layer, and the picture it showed when the dialog opened.
  const [imageTool, setImageTool] = useState<{ kind: "cutout" | "inpaint"; layerId: string; source: CutoutSource } | null>(null);

  /* ---------- resources: object URLs and user fonts ---------- */
  const urls = useObjectUrls(resources);
  const imageUrl = useCallback((rid: string) => urls.get(rid) ?? (getBuiltinArt(rid) ? artUrl(getBuiltinArt(rid)!) : null), [urls]);
  const fontKey = doc.layers.map((l) => (l.type === "text" ? `${l.font}/${l.weight}/${l.italic}` : "")).join("|");
  useEffect(() => {
    let live = true;
    const used = new Set(referencedResources(doc));
    Promise.all(resources.filter((r) => r.kind === "font" && used.has(r.id)).map((r) => registerUserFont(r.id, r.blob).catch(() => undefined)))
      .then(() => loadDocFonts(doc))
      .then(() => live && setFontsVersion((v) => v + 1));
    return () => {
      live = false;
    };
    // Reload faces only when the set of fonts in use changes, not on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey, resources]);

  /* ---------- autosave ---------- */
  useEffect(() => {
    if (doc === saved.current) return;
    setSaveState("unsaved");
    const t = setTimeout(() => {
      setSaveState("saving");
      saveDesign({ ...doc, projectId: projectId.current })
        .then(() => {
          saved.current = doc;
          setSaveState((s) => (s === "saving" ? "saved" : s));
        })
        .catch((e: unknown) => {
          setSaveState("failed");
          toast(e instanceof Error ? e.message : "The design couldn't be saved.");
        });
    }, 600);
    return () => clearTimeout(t);
  }, [doc]);
  const guard = useDraftGuard(saveState !== "saved");

  /* ---------- background removal ---------- */
  const sourceFor = (rid: string): CutoutSource | null => {
    const own = resources.find((r) => r.id === rid && r.kind === "image");
    if (own) return { resourceId: rid, name: own.name, width: own.width, height: own.height, load: async () => own.blob, url: urls.get(rid) ?? null };
    const art = getBuiltinArt(rid);
    if (!art) return null;
    const url = artUrl(art);
    return {
      resourceId: rid,
      name: art.name,
      url,
      load: async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error("The picture couldn't be read.");
        return res.blob();
      },
    };
  };
  const licenceFor = (rid: string) => {
    const own = resources.find((r) => r.id === rid);
    if (own) return own.licence;
    const art = getBuiltinArt(rid);
    return { id: "CC0-1.0", author: art?.author ?? "Unknown", source: art?.source ?? "FrameProof" };
  };
  // The result becomes a new picture linked to its source; the layer switches to it as one undo step.
  const acceptToolResult = async (kind: "cutout" | "inpaint", layerId: string, source: CutoutSource, result: ToolResult) => {
    const label = kind === "cutout" ? "cut-out" : "filled";
    const res = await addResource(result.png, "image", {
      name: `${source.name} (${label})`,
      licence: licenceFor(source.resourceId),
      tags: [label],
      derivedFrom: { resourceId: source.resourceId, tool: kind, model: result.model.name },
    });
    h.commit((d) => updateLayer(d, layerId, { resourceId: res.id }));
    toast(`${kind === "cutout" ? "Cut-out" : "Filled picture"} saved as a new picture; the original is unchanged.`);
  };
  const openImageTool = (kind: "cutout" | "inpaint") => {
    if (selected?.type !== "image" || !selected.resourceId) return;
    const source = sourceFor(selected.resourceId);
    if (source) setImageTool({ kind, layerId: selected.id, source });
    else toast("This picture isn't in the library any more.");
  };

  /* ---------- edits ---------- */
  const selected = doc.layers.find((l) => l.id === selectedId) ?? null;
  const patchLayer = useCallback((lid: string, patch: Partial<Layer>, key?: string) => h.commit((d) => updateLayer(d, lid, patch), key), [h]);
  const add = (layers: Parameters<typeof addLayer>[1]) => {
    try {
      const res = addLayer(doc, layers);
      h.commit(res.doc);
      setSelectedId(res.ids[res.ids.length - 1] ?? null);
      setTab("edit");
    } catch (e) {
      toast(e instanceof Error ? e.message : "The layer couldn't be added.");
    }
  };
  const onStarter = (kind: StarterKind) => add(starterLayer(doc, kind, newId("l")));
  const onItem = (item: Item) => add(placeItem(item, doc, newId));
  const onImage = (rid: string) => {
    if (selected?.type === "image") return patchLayer(selected.id, { resourceId: rid });
    const r = resources.find((x) => x.id === rid) ?? getBuiltinArt(rid);
    const ratio = r?.width && r?.height ? r.width / r.height : 1;
    const w = Math.round(doc.width * 0.6);
    add({ ...starterLayer(doc, "image", newId("l")), name: r?.name.slice(0, 80) ?? "Image", resourceId: rid, w, h: Math.round(w / ratio) } as Parameters<typeof addLayer>[1]);
  };
  // A logo goes on its own layer, whole (contain), about a fifth of the short side, in the bottom-right corner.
  const onLogo = (rid: string) => {
    const r = resources.find((x) => x.id === rid);
    const ratio = r?.width && r?.height ? r.width / r.height : 1;
    const side = Math.min(doc.width, doc.height);
    const box = side * 0.2;
    const w = Math.round(ratio >= 1 ? box : box * ratio);
    const h = Math.round(ratio >= 1 ? box / ratio : box);
    const m = Math.round(side * 0.05);
    add({ ...starterLayer(doc, "image", newId("l")), name: "Logo", role: "logo", fit: "contain", resourceId: rid, w, h, x: doc.width - m - w, y: doc.height - m - h } as Parameters<typeof addLayer>[1]);
  };
  const del = (lid: string) => {
    h.commit((d) => removeLayer(d, lid));
    setSelectedId(null);
  };
  const dup = (lid: string) => {
    const res = duplicateLayer(doc, lid, newId("l"));
    if (res.id) {
      h.commit(res.doc);
      setSelectedId(res.id);
    }
  };
  const nudge = (dx: number, dy: number) => {
    if (selected && !selected.locked) patchLayer(selected.id, { x: selected.x + dx, y: selected.y + dy }, `${selected.id}:nudge`);
  };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (comparing) return;
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, select, [contenteditable]");
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        h.redo();
        return;
      }
      if (typing || !selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        del(selected.id);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        dup(selected.id);
      } else if (e.key === "Escape") setSelectedId(null);
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        nudge(e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------- export and review ---------- */
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(missingMessage(e, resources));
    } finally {
      setBusy(null);
    }
  };
  const exportPng = () => run("png", () => withExportAccess(async () => downloadBlob(`${fileName(doc)}.png`, await designPng(doc, resources, 1))));
  const exportSvgFile = () => run("svg", () => withExportAccess(async () => downloadBlob(`${fileName(doc)}.svg`, new Blob([await designSvg(doc, resources)], { type: "image/svg+xml" }))));
  const exportJson = () => run("json", () => withExportAccess(async () => downloadBlob(`${fileName(doc)}.frameproof.json`, new Blob([await designBundle(doc, resources)], { type: "application/json" }))));
  // Save first, so the formats are recomposed from what's on screen, then open them.
  const campaign = () =>
    run("campaign", async () => {
      await saveDesign({ ...doc, projectId: projectId.current });
      saved.current = doc;
      setSaveState("saved");
      router.push(`/campaign?id=${encodeURIComponent(doc.id)}`);
    });
  const review = () =>
    run("review", async () => {
      const png = await designPng(doc, resources, 1);
      const project = await sendDesignToReview({ ...doc, projectId: projectId.current }, png);
      projectId.current = project.id;
      setLinked(true);
      saved.current = doc;
      setSaveState("saved");
      toast("Design sent to review as the current image.");
      router.push(`/project?id=${encodeURIComponent(project.id)}`);
    });

  const userFonts = resources.filter((r) => r.kind === "font").map((r) => ({ id: r.id as `res_${string}`, label: r.name.replace(/\.(ttf|otf|woff2?)$/i, "") }));
  const cards = (kind: "image" | "font"): ResourceCard[] => resources.filter((r) => r.kind === kind).map((r) => ({ id: r.id, name: r.name, url: urls.get(r.id) ?? null, licence: r.licence, kind, logo: r.tags.includes("logo") }));
  const missing = referencedResources(doc).filter((rid) => !isBuiltinArt(rid) && !resources.some((r) => r.id === rid));
  const status = { saved: "Saved in this browser", saving: "Saving…", unsaved: "Unsaved changes", failed: "Not saved" }[saveState];

  return (
    <div className="design-editor" data-tab={tab}>
      {guard.dialog}
      <div className="design-bar">
        <Link href="/design" className="btn btn-sm btn-quiet">
          Designs
        </Link>
        <h1 className="t-heading design-title">{doc.name}</h1>
        <span className="hint" role="status" data-testid="save-state">
          {status}
        </span>
        <span className="spacer" />
        <button type="button" className="btn btn-sm" onClick={h.undo} disabled={!h.canUndo}>
          Undo
        </button>
        <button type="button" className="btn btn-sm" onClick={h.redo} disabled={!h.canRedo}>
          Redo
        </button>
        <button type="button" className="btn btn-sm" onClick={exportPng} disabled={!!busy}>
          {busy === "png" ? "Exporting…" : "Export PNG"}
        </button>
        <button type="button" className="btn btn-sm" onClick={exportSvgFile} disabled={!!busy}>
          {busy === "svg" ? "Exporting…" : "Export SVG"}
        </button>
        <button type="button" className="btn btn-sm" onClick={exportJson} disabled={!!busy}>
          {busy === "json" ? "Exporting…" : "Export design file"}
        </button>
        <button type="button" className="btn btn-sm" onClick={campaign} disabled={!!busy}>
          Campaign formats
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={review} disabled={!!busy}>
          {busy === "review" ? "Sending…" : linked ? "Update review image" : "Review this design"}
        </button>
      </div>
      {missing.length ? (
        <p className="notice" data-tone="error">
          {missing.length === 1 ? "One picture or font" : `${missing.length} pictures or fonts`} used here {missing.length === 1 ? "is" : "are"} no longer in your library. Pick another in the inspector, or
          delete the layer, before exporting.
        </p>
      ) : null}

      <nav className="modes design-tabs" aria-label="Editor panels">
        {(["edit", "layers", "add"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {{ layers: "Layers", edit: "Edit", add: "Add" }[t]}
          </button>
        ))}
      </nav>

      <div className="design-grid">
        <div className="design-col design-col-left">
          <div className="design-pane" data-pane="add">
            <AddPanel
              items={ITEMS}
              images={cards("image")}
              art={BUILTIN_ART.map((a) => ({ id: a.id, name: a.name, url: artUrl(a), licence: { id: "CC0-1.0", author: a.author, source: a.source }, kind: "image" as const, credit: `${a.author}, ${a.title}, ${a.date}` }))}
              fonts={cards("font")}
              onStarter={onStarter}
              onItem={onItem}
              onImage={onImage}
              onLogo={onLogo}
              onAddResource={async (file, kind, meta) => {
                const r = await addResource(file, kind, meta);
                toast(`${r.name} added to your library.`);
              }}
              fontsVersion={fontsVersion}
            />
          </div>
          <div className="design-pane" data-pane="layers">
            <LayersPanel
              doc={doc}
              selectedId={selectedId}
              onSelect={(lid) => setSelectedId(lid)}
              onToggle={(lid, key) => {
                const l = doc.layers.find((x) => x.id === lid);
                if (l) patchLayer(lid, { [key]: !l[key] } as Partial<Layer>);
              }}
              onMove={(lid, move) => h.commit((d) => moveLayer(d, lid, move))}
              onDuplicate={dup}
              onDelete={del}
            />
          </div>
        </div>
        <div className="design-pane design-pane-canvas" data-pane="canvas">
          {comparing ? (
            <p className="notice design-compare-note" role="status">
              Showing the design before your palette changes. Editing is paused until you go back to current.
            </p>
          ) : null}
          <Canvas
            doc={comparing && before ? before : doc}
            selectedId={comparing ? null : selectedId}
            onSelect={comparing ? () => {} : setSelectedId}
            onLive={comparing ? () => {} : h.live}
            onEnd={comparing ? () => {} : h.end}
            imageUrl={imageUrl}
            fontsVersion={fontsVersion}
            onEditText={() => {
              setTab("edit");
              setTimeout(() => textRef.current?.focus(), 0);
            }}
          />
          <p className="hint design-canvas-hint">Drag to move. Handles resize; the round handle rotates. Shift keeps proportions, Alt turns off snapping. Arrow keys nudge.</p>
        </div>
        <div className="design-col design-col-right">
          <div className="design-pane" data-pane="edit">
            <section className="design-panel" aria-label="Design palette">
              <DocPalette
                doc={doc}
                onLive={(next) => {
                  if (!before) setBefore(doc);
                  setComparing(false);
                  h.live(next);
                }}
                onEnd={h.end}
                onCommit={(next) => h.commit(next)}
                comparing={comparing}
                onCompare={setComparing}
                canCompare={before !== null}
              />
            </section>
            <fieldset className="design-fieldset" disabled={comparing}>
            <Inspector
              doc={doc}
              layer={selected}
              onLayer={(patch, key) => selected && patchLayer(selected.id, patch, key)}
              onDoc={(patch, key) => h.commit((d) => ({ ...d, ...patch }), key)}
              userFonts={userFonts}
              images={[...resources.filter((r) => r.kind === "image").map((r) => ({ id: r.id, label: r.name })), ...BUILTIN_ART.map((a) => ({ id: a.id, label: `${a.name} (${a.author.split(",")[0]}, public domain)` }))]}
              textRef={textRef}
              onNudge={nudge}
              onCutout={() => openImageTool("cutout")}
              onInpaint={() => openImageTool("inpaint")}
            />
            </fieldset>
          </div>
        </div>
      </div>
      {imageTool?.kind === "cutout" ? (
        <CutoutDialog source={imageTool.source} onAccept={(r) => acceptToolResult("cutout", imageTool.layerId, imageTool.source, r)} onClose={() => setImageTool(null)} />
      ) : null}
      {imageTool?.kind === "inpaint" ? (
        <InpaintDialog source={imageTool.source} onAccept={(r) => acceptToolResult("inpaint", imageTool.layerId, imageTool.source, r)} onClose={() => setImageTool(null)} />
      ) : null}
    </div>
  );
}
