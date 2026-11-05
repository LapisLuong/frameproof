"use client";

import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { brushInImage, clampRect, defaultRect, INPAINT_MAX_PIXELS, paintToMask, strokePoints, type Rect } from "@/lib/design/mask";
import type { InpaintTool, ModelInfo, ToolProgress, ToolResult } from "@/lib/image-tools/types";
import type { ImageToolSource } from "./CutoutDialog";
import { ModelLine, stageText } from "./ImageToolParts";

/**
 * Fill an area of a picture (LaMa), in this browser. The user paints over what should go; the model reconstructs
 * it from the surroundings. Everything outside the painted area comes back unchanged. The result is a new picture
 * linked to the original, which is never modified. A reconstruction is a guess, and the copy says so.
 */

type Phase =
  | { kind: "checking" }
  | { kind: "unsupported"; reason: string }
  | { kind: "paint"; model: ModelInfo }
  | { kind: "running"; model: ModelInfo; progress: ToolProgress | null }
  | { kind: "preview"; model: ModelInfo; result: ToolResult; url: string; saveError?: string }
  | { kind: "saving"; model: ModelInfo; result: ToolResult; url: string }
  | { kind: "error"; message: string; model: ModelInfo };

type Picture = { blob: Blob; width: number; height: number; url: string };

export function InpaintDialog({ source, onAccept, onClose }: { source: ImageToolSource; onAccept: (result: ToolResult) => Promise<void>; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [picture, setPicture] = useState<Picture | null>(null);
  const [brush, setBrush] = useState(40);
  const [erase, setErase] = useState(false);
  const [painted, setPainted] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  // Keyboard alternative to the brush: a rectangle typed in picture pixels, outlined on the picture.
  const [rect, setRect] = useState<Rect | null>(null);
  const tool = useRef<InpaintTool | null>(null);
  const abort = useRef<AbortController | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const snapshot = useRef<ImageData | null>(null);
  const resultUrl = phase.kind === "preview" || phase.kind === "saving" ? phase.url : null;

  // Load the tool (only now, not with the editor) and the picture's real size.
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    (async () => {
      let t: InpaintTool;
      try {
        t = (await import("@/lib/image-tools/inpaint")).lamaTool;
      } catch {
        if (live) setPhase({ kind: "unsupported", reason: "Filling an area isn't available in this build." });
        return;
      }
      const ok = await t.supported();
      if (!live) return;
      if (!ok.ok) return setPhase({ kind: "unsupported", reason: ok.reason });
      tool.current = t;
      try {
        const blob = await source.load();
        const bmp = await createImageBitmap(blob);
        const { width, height } = bmp;
        bmp.close();
        if (!live) return;
        if (width * height > INPAINT_MAX_PIXELS)
          return setPhase({
            kind: "unsupported",
            reason: `This picture is ${width} × ${height} px (${(width * height / 1e6).toFixed(1)} MP). Filling an area works on pictures up to 4 MP, to keep memory in check; use a smaller copy.`,
          });
        url = URL.createObjectURL(blob);
        setPicture({ blob, width, height, url });
        setRect(defaultRect(width, height));
        setPhase({ kind: "paint", model: t.model });
      } catch {
        if (live) setPhase({ kind: "unsupported", reason: "The picture couldn't be read." });
      }
    })();
    return () => {
      live = false;
      abort.current?.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);
  useEffect(() => () => void (resultUrl && URL.revokeObjectURL(resultUrl)), [resultUrl]);

  /* ---------- painting ---------- */
  const ctx = () => canvas.current?.getContext("2d", { willReadFrequently: true }) ?? null;
  const toImage = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height, display: r.width };
  };
  const dab = (from: { x: number; y: number }, to: { x: number; y: number }, display: number) => {
    const g = ctx();
    if (!g || !canvas.current) return;
    const d = brushInImage(brush, display, canvas.current.width);
    g.globalCompositeOperation = erase ? "destination-out" : "source-over";
    g.fillStyle = "#c65a42";
    for (const p of strokePoints(from, to, d)) {
      g.beginPath();
      g.arc(p.x, p.y, d / 2, 0, Math.PI * 2);
      g.fill();
    }
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase.kind !== "paint") return;
    const g = ctx();
    if (!g || !canvas.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    snapshot.current = g.getImageData(0, 0, canvas.current.width, canvas.current.height);
    setCanUndo(true);
    const p = toImage(e);
    last.current = p;
    dab(p, p, p.display);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const p = toImage(e);
    dab(last.current, p, p.display);
    last.current = p;
  };
  const up = () => {
    if (!last.current) return;
    last.current = null;
    setPainted(hasPaint());
  };
  const hasPaint = () => {
    const g = ctx();
    if (!g || !canvas.current) return false;
    const d = g.getImageData(0, 0, canvas.current.width, canvas.current.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) return true;
    return false;
  };
  const undoStroke = () => {
    const g = ctx();
    if (!g || !snapshot.current) return;
    g.putImageData(snapshot.current, 0, 0);
    snapshot.current = null;
    setCanUndo(false);
    setPainted(hasPaint());
  };
  const clear = () => {
    const g = ctx();
    if (!g || !canvas.current) return;
    snapshot.current = g.getImageData(0, 0, canvas.current.width, canvas.current.height);
    setCanUndo(true);
    g.clearRect(0, 0, canvas.current.width, canvas.current.height);
    setPainted(false);
  };

  const markRect = () => {
    const g = ctx();
    if (!g || !canvas.current || !rect) return;
    snapshot.current = g.getImageData(0, 0, canvas.current.width, canvas.current.height);
    setCanUndo(true);
    g.globalCompositeOperation = erase ? "destination-out" : "source-over";
    g.fillStyle = "#c65a42";
    g.fillRect(rect.x, rect.y, rect.w, rect.h);
    setPainted(hasPaint());
  };
  const setRectField = (k: keyof Rect, v: number) => picture && rect && setRect(clampRect({ ...rect, [k]: v }, picture.width, picture.height));

  const maskBlob = async (): Promise<Blob> => {
    const c = canvas.current!;
    const { mask } = paintToMask(ctx()!.getImageData(0, 0, c.width, c.height).data);
    const out = new OffscreenCanvas(c.width, c.height);
    out.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(mask), c.width, c.height), 0, 0);
    return out.convertToBlob({ type: "image/png" });
  };

  /* ---------- running ---------- */
  const run = async () => {
    const t = tool.current;
    if (!t || !picture) return;
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const mask = await maskBlob();
      setPhase({ kind: "running", model: t.model, progress: null });
      const result = await t.inpaint(picture.blob, mask, {
        signal: ctl.signal,
        onProgress: (progress) => !ctl.signal.aborted && setPhase({ kind: "running", model: t.model, progress }),
      });
      if (ctl.signal.aborted) return;
      setPhase({ kind: "preview", model: t.model, result, url: URL.createObjectURL(result.png) });
    } catch (e) {
      if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Filling the area failed.", model: t.model });
    } finally {
      if (abort.current === ctl) abort.current = null;
    }
  };
  const backToMask = () => tool.current && setPhase({ kind: "paint", model: tool.current.model });
  const cancelRun = () => {
    abort.current?.abort();
    abort.current = null;
    backToMask();
  };
  const accept = async () => {
    if (phase.kind !== "preview") return;
    const { model, result, url } = phase;
    setPhase({ kind: "saving", model, result, url });
    try {
      await onAccept(result);
      onClose();
    } catch (e) {
      // Keep the result: saving again must not mean running the model again.
      setPhase({ kind: "preview", model, result, url, saveError: e instanceof Error ? e.message : "The result couldn't be saved." });
    }
  };

  const busy = phase.kind === "running" || phase.kind === "saving";
  const showPainter = picture && (phase.kind === "paint" || phase.kind === "running" || phase.kind === "error");

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog cutout-dialog inpaint-dialog" aria-describedby={undefined}>
          <Dialog.Title className="t-heading">Fill an area</Dialog.Title>
          <p className="t-meta">
            {source.name}. Paint over what should go; the model rebuilds it from what&apos;s around it. Runs in this browser; the picture stays on this device, and the original is
            kept as it is.
          </p>

          {phase.kind === "checking" ? <div className="busy-line" aria-label="Checking this browser" /> : null}
          {phase.kind === "unsupported" ? (
            <p className="notice" data-tone="error" role="alert">
              {phase.reason}
            </p>
          ) : null}

          {phase.kind !== "checking" && phase.kind !== "unsupported" ? <ModelLine model={phase.model} /> : null}

          {/* The painter stays mounted while running so a cancel or an error returns to the same mask. */}
          {picture ? (
            <div className="inpaint-stage" hidden={!showPainter}>
              <div className="inpaint-frame">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
              <img src={picture.url} alt="" draggable={false} />
              <canvas
                ref={canvas}
                width={picture.width}
                height={picture.height}
                className="inpaint-mask"
                aria-label="Painted area to fill"
                data-testid="inpaint-canvas"
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
              />
              {rect && phase.kind === "paint" ? (
                <span
                  className="inpaint-rect"
                  aria-hidden
                  style={{ left: `${(rect.x / picture.width) * 100}%`, top: `${(rect.y / picture.height) * 100}%`, width: `${(rect.w / picture.width) * 100}%`, height: `${(rect.h / picture.height) * 100}%` }}
                />
              ) : null}
              </div>
            </div>
          ) : null}

          {phase.kind === "paint" || phase.kind === "error" ? (
            <div className="inpaint-tools">
              <label className="t-meta">
                Brush <span className="t-value">{brush} px</span>
                <input type="range" className="slider" min={8} max={160} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
              </label>
              <div className="design-row" role="group" aria-label="Brush">
                <button type="button" className="btn btn-sm" aria-pressed={!erase} onClick={() => setErase(false)}>
                  Paint
                </button>
                <button type="button" className="btn btn-sm" aria-pressed={erase} onClick={() => setErase(true)}>
                  Erase
                </button>
                <button type="button" className="btn btn-sm" onClick={undoStroke} disabled={!canUndo}>
                  Undo stroke
                </button>
                <button type="button" className="btn btn-sm" onClick={clear} disabled={!painted}>
                  Clear
                </button>
              </div>
              <p className="hint">Cover a little beyond the edges of what should go.</p>
              {rect && picture ? (
                <fieldset className="inpaint-rect-fields">
                  <legend className="t-meta">Or mark a rectangle (picture pixels, outlined on the picture)</legend>
                  <div className="design-row">
                    {(
                      [
                        ["x", "X"],
                        ["y", "Y"],
                        ["w", "Width"],
                        ["h", "Height"],
                      ] as const
                    ).map(([k, label]) => (
                      <label key={k} className="field">
                        <span>{label}</span>
                        <input type="number" className="input" inputMode="numeric" min={k === "w" || k === "h" ? 1 : 0} value={rect[k]} onChange={(e) => setRectField(k, Number(e.target.value))} />
                      </label>
                    ))}
                  </div>
                  <button type="button" className="btn btn-sm" onClick={markRect}>
                    {erase ? "Erase this rectangle" : "Add this rectangle"}
                  </button>
                </fieldset>
              ) : null}
            </div>
          ) : null}

          {phase.kind === "running" ? (
            <div className="cutout-progress" role="status" aria-live="polite">
              <p className="t-small">{stageText(phase.progress, "Filling the area…")}</p>
              {phase.progress?.stage === "download" && phase.progress.total ? (
                <progress max={phase.progress.total} value={phase.progress.loaded} aria-label="Model download" />
              ) : (
                <div className="busy-line" aria-hidden />
              )}
            </div>
          ) : null}

          {phase.kind === "error" ? (
            <p className="notice" data-tone="error" role="alert">
              {phase.message}
            </p>
          ) : null}

          {(phase.kind === "preview" || phase.kind === "saving") && picture ? (
            <>
              <div className="cutout-compare">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
                  <img src={picture.url} alt="" />
                  <figcaption className="t-meta">Original</figcaption>
                </figure>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
                  <img src={phase.url} alt={`${source.name} with the painted area filled`} />
                  <figcaption className="t-meta">
                    Filled,{" "}
                    <span className="t-value">
                      {phase.result.width} × {phase.result.height} px
                    </span>
                  </figcaption>
                </figure>
              </div>
              <p className="t-small">
                {phase.result.model.name} took <span className="t-value">{(phase.result.ms.run / 1000).toFixed(1)} s</span>. The filled area is the model&apos;s reconstruction,
                not what was really there; the rest of the picture is unchanged.
              </p>
            </>
          ) : null}

          {phase.kind === "preview" && phase.saveError ? (
            <p className="notice" data-tone="error" role="alert">
              The filled picture couldn&apos;t be saved: {phase.saveError} It&apos;s kept here; try saving again.
            </p>
          ) : null}

          <div className="dialog-actions">
            {phase.kind === "running" ? (
              <button type="button" className="btn" onClick={cancelRun}>
                Cancel
              </button>
            ) : (
              <button type="button" className="btn" onClick={onClose} disabled={busy}>
                {phase.kind === "preview" ? "Discard" : "Close"}
              </button>
            )}
            {phase.kind === "preview" ? (
              <button type="button" className="btn" onClick={backToMask}>
                Change the painted area
              </button>
            ) : null}
            {phase.kind === "paint" || phase.kind === "error" ? (
              <button type="button" className="btn btn-primary" onClick={() => void run()} disabled={!painted}>
                {phase.kind === "error" ? "Try again" : "Fill painted area"}
              </button>
            ) : null}
            {phase.kind === "preview" || phase.kind === "saving" ? (
              <button type="button" className="btn btn-primary" onClick={() => void accept()} disabled={phase.kind === "saving"}>
                {phase.kind === "preview" && phase.saveError ? "Retry save" : "Use the filled picture"}
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
