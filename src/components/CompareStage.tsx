"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { compareBuffers } from "@/lib/analysis/analyze";
import { pixelsFromBlob } from "@/lib/image/decode";
import type { Asset } from "@/lib/store/models";
import { useObjectUrl } from "@/hooks/useStore";
import { ImageViewer, type ArtworkMark } from "./ImageViewer";
import { FIT, useZoomPan, type View } from "./useZoomPan";

export type CompareMode = "side" | "slider" | "overlay" | "diff";
const MODES: Array<{ id: CompareMode; label: string }> = [
  { id: "side", label: "Side by side" },
  { id: "slider", label: "Slider" },
  { id: "overlay", label: "Overlay" },
  { id: "diff", label: "Difference" },
];

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** The box both images are fitted into: the reference's aspect ratio, as large as the stage allows. */
function fitBox(stage: { w: number; h: number }, aspect: number, pad = 48) {
  const W = Math.max(0, stage.w - pad * 2);
  const H = Math.max(0, stage.h - pad * 2);
  return W / H > aspect ? { w: H * aspect, h: H } : { w: W, h: W / aspect };
}

function Layered({
  reference,
  current,
  mode,
  amount,
  diffCanvas,
}: {
  reference: Asset;
  current: Asset;
  mode: "slider" | "overlay" | "diff";
  amount: number;
  diffCanvas: React.RefObject<HTMLCanvasElement | null>;
}) {
  const refUrl = useObjectUrl(reference.blob);
  const curUrl = useObjectUrl(current.blob);
  const zp = useZoomPan();
  const [stageRef, stage] = useBoxSize<HTMLDivElement>();
  const box = fitBox(stage, reference.width / reference.height);
  const dark = mode !== "slider";
  const img: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", userSelect: "none" };

  return (
    <div
      ref={stageRef}
      className="stage"
      data-dark={dark ? "true" : undefined}
      style={{ height: "min(72vh, 46rem)", cursor: "grab" }}
      tabIndex={0}
      role="group"
      aria-label="Comparison. Use plus and minus to zoom, arrow keys to pan, 0 to fit."
      {...zp.handlers}
    >
      <span className="stage-label">Reference{mode === "diff" ? " vs current" : ""}</span>
      {mode !== "diff" ? (
        <span className="stage-label" data-side="right">
          Current
        </span>
      ) : null}
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ position: "relative", width: box.w, height: box.h, transform: zp.transform, transition: "transform 60ms linear" }}>
          {mode === "diff" ? (
            <canvas
              ref={diffCanvas}
              style={{ ...img, imageRendering: "pixelated" }}
              aria-label="Difference map: brighter red means a larger change in lightness"
              role="img"
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {refUrl ? <img src={refUrl} alt="Reference" draggable={false} style={img} /> : null}
              {curUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={curUrl}
                  alt="Current design"
                  draggable={false}
                  style={{
                    ...img,
                    ...(mode === "slider" ? { clipPath: `inset(0 0 0 ${amount}%)`, background: "var(--color-sheet)" } : { opacity: amount / 100 }),
                  }}
                />
              ) : null}
              {mode === "slider" ? (
                <span
                  aria-hidden="true"
                  style={{ position: "absolute", top: -12, bottom: -12, left: `${amount}%`, width: 0, borderLeft: "1.5px solid var(--color-proof)" }}
                />
              ) : null}
            </>
          )}
          <span className="cropmarks" style={{ inset: 0 }} aria-hidden="true">
            <i />
          </span>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        Zoom {Math.round(zp.view.scale * 100)} percent
      </div>
      <button type="button" className="btn btn-sm" style={{ position: "absolute", right: "0.75rem", bottom: "0.75rem" }} onClick={zp.fit}>
        Fit
      </button>
    </div>
  );
}

function useNarrow(query = "(max-width: 640px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

export type StageMarks = { reference: ArtworkMark[]; current: ArtworkMark[] };
const NO_MARKS: StageMarks = { reference: [], current: [] };

export function CompareStage({
  reference,
  current,
  marks = NO_MARKS,
  selectedId,
  onSelect,
}: {
  reference: Asset;
  current: Asset;
  marks?: StageMarks;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const hasMarks = marks.reference.length + marks.current.length > 0;
  const [mode, setMode] = useState<CompareMode>("side");
  const narrow = useNarrow();
  const [shown, setShown] = useState<"reference" | "current">("reference");
  const [slider, setSlider] = useState(50);
  const [opacity, setOpacity] = useState(50);
  const [linked, setLinked] = useState(true);
  const [sharedView, setSharedView] = useState<View>(FIT);
  const refUrl = useObjectUrl(reference.blob);
  const curUrl = useObjectUrl(current.blob);
  const diffCanvas = useRef<HTMLCanvasElement | null>(null);
  const [diffInfo, setDiffInfo] = useState<{ changed: number; note: string } | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  // Compute and paint the difference map when that mode is shown.
  useEffect(() => {
    if (mode !== "diff") return;
    let live = true;
    (async () => {
      try {
        const [a, b] = await Promise.all([pixelsFromBlob(reference.blob), pixelsFromBlob(current.blob)]);
        const cmp = compareBuffers(a, b, reference, current);
        const c = diffCanvas.current;
        if (!live || !c) return;
        const { width: w, height: h, values } = cmp.diff;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(w, h);
        for (let i = 0; i < values.length; i++) {
          const v = Math.min(1, values[i]! * 2.5); // amplify so small changes are visible; scale is shown in the legend
          img.data[i * 4] = 37 + (198 - 37) * v;
          img.data[i * 4 + 1] = 40 + (90 - 40) * v;
          img.data[i * 4 + 2] = 38 + (66 - 38) * v;
          img.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        setDiffError(null);
        setDiffInfo({ changed: cmp.changedShare, note: cmp.canvas.note });
      } catch {
        if (live) setDiffError("The difference map couldn't be computed for these images.");
      }
    })();
    return () => {
      live = false;
    };
  }, [mode, reference, current]);

  const sameAspect = Math.abs(reference.width / reference.height - current.width / current.height) / (reference.width / reference.height) < 0.02;

  return (
    <section aria-label="Compare reference and current design">
      <div className="toolbar">
        <div className="modes" role="toolbar" aria-label="Comparison mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span className="spacer" />
        {mode === "side" && narrow ? (
          <div className="modes" role="toolbar" aria-label="Image shown">
            <button type="button" aria-pressed={shown === "reference"} onClick={() => setShown("reference")}>
              Reference
            </button>
            <button type="button" aria-pressed={shown === "current"} onClick={() => setShown("current")}>
              Current
            </button>
          </div>
        ) : null}
        {mode === "side" && !narrow ? (
          <label className="t-meta" style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center" }}>
            <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} /> Link zoom and pan
          </label>
        ) : null}
        {mode === "slider" ? (
          <label className="t-meta" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            Split
            <input
              className="slider"
              type="range"
              min={0}
              max={100}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              aria-valuetext={`${slider}% reference visible`}
            />
          </label>
        ) : null}
        {mode === "overlay" ? (
          <label className="t-meta" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            Current opacity
            <input
              className="slider"
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              aria-valuetext={`${opacity}%`}
            />
            <span className="t-value" style={{ width: "2.6rem" }}>
              {opacity}%
            </span>
          </label>
        ) : null}
      </div>

      {mode === "side" && narrow && refUrl && curUrl ? (
        <ImageViewer
          key="single"
          src={shown === "reference" ? refUrl : curUrl}
          alt={shown === "reference" ? "Reference" : "Current design"}
          label={shown === "reference" ? "Reference" : "Current"}
          height="22.5rem"
          shared={{ view: sharedView, onView: setSharedView }}
          marks={shown === "reference" ? marks.reference : marks.current}
          selectedId={selectedId}
          onMark={onSelect}
        />
      ) : null}
      {mode === "side" && !narrow && refUrl && curUrl ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))", gap: "1rem" }}>
          <ImageViewer
            src={refUrl}
            alt="Reference"
            label="Reference"
            height="min(64vh, 40rem)"
            shared={linked ? { view: sharedView, onView: setSharedView } : undefined}
            marks={marks.reference}
            selectedId={selectedId}
            onMark={onSelect}
          />
          <ImageViewer
            src={curUrl}
            alt="Current design"
            label="Current"
            height="min(64vh, 40rem)"
            shared={linked ? { view: sharedView, onView: setSharedView } : undefined}
            marks={marks.current}
            selectedId={selectedId}
            onMark={onSelect}
          />
        </div>
      ) : null}
      {mode === "slider" || mode === "overlay" || mode === "diff" ? (
        <Layered reference={reference} current={current} mode={mode} amount={mode === "slider" ? slider : opacity} diffCanvas={diffCanvas} />
      ) : null}

      <p className="t-small" style={{ marginTop: "0.5rem" }}>
        {mode === "side"
          ? narrow
            ? "Switch between the two images; zoom and position are kept."
            : "Each image is fitted to its own frame."
          : sameAspect
            ? "Both images are fitted into the reference's frame without stretching."
            : "The formats differ, so the current design is letterboxed inside the reference's frame — it is never stretched."}
        {hasMarks ? (mode === "side" ? " Numbered marks point to notes in the margin." : " Numbered marks show in side by side.") : ""}
        {mode === "diff" && diffInfo
          ? ` ${(diffInfo.changed * 100).toFixed(1)}% of the area changed lightness by more than 10%. Brighter red means a bigger change; differences are amplified 2.5× for visibility. ${diffInfo.note}`
          : ""}
      </p>
      {diffError ? (
        <p className="error-text" role="alert">
          {diffError}
        </p>
      ) : null}
    </section>
  );
}
