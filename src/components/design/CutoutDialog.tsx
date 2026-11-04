"use client";

import { Dialog } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import type { CutoutTool, ModelInfo, ToolProgress, ToolResult } from "@/lib/image-tools/types";

/**
 * Background removal for a picture layer, run in this browser (BEN2). The user sees what will be downloaded before
 * anything is, can cancel at any stage, and compares the result with the original before accepting it. Accepting
 * saves the cut-out as a new picture linked to its source; the original picture is never changed.
 *
 * The runtime module is imported only when the dialog opens, so the editor doesn't carry it until it's used.
 */

export type CutoutSource = { resourceId: string; name: string; width?: number; height?: number; load: () => Promise<Blob>; url: string | null };

type Phase =
  | { kind: "checking" }
  | { kind: "unsupported"; reason: string }
  | { kind: "confirm"; model: ModelInfo }
  | { kind: "running"; model: ModelInfo; progress: ToolProgress | null }
  | { kind: "preview"; result: ToolResult; url: string }
  | { kind: "saving"; result: ToolResult; url: string }
  | { kind: "error"; message: string; model: ModelInfo | null };

const mb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`;

function stageText(p: ToolProgress | null): string {
  if (!p) return "Starting…";
  if (p.stage === "download") return p.total ? `Downloading the model: ${mb(p.loaded)} of ${mb(p.total)}` : `Downloading the model: ${mb(p.loaded)}`;
  if (p.stage === "load") return "Loading the model…";
  if (p.stage === "run") return "Finding the subject…";
  return "Preparing the result…";
}

export function CutoutDialog({ source, onAccept, onClose }: { source: CutoutSource; onAccept: (result: ToolResult) => Promise<void>; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const tool = useRef<CutoutTool | null>(null);
  const abort = useRef<AbortController | null>(null);
  const resultUrl = phase.kind === "preview" || phase.kind === "saving" ? phase.url : null;

  useEffect(() => {
    let live = true;
    import("@/lib/image-tools/cutout")
      .then(async (m) => {
        const t = m.cutoutTool;
        const ok = await t.supported();
        if (!live) return;
        tool.current = t;
        setPhase(ok.ok ? { kind: "confirm", model: t.model } : { kind: "unsupported", reason: ok.reason });
      })
      .catch(() => live && setPhase({ kind: "unsupported", reason: "Background removal isn't available in this build." }));
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, []);
  useEffect(() => () => void (resultUrl && URL.revokeObjectURL(resultUrl)), [resultUrl]);

  const run = async () => {
    const t = tool.current;
    if (!t) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setPhase({ kind: "running", model: t.model, progress: null });
    try {
      const blob = await source.load();
      const result = await t.removeBackground(blob, {
        signal: ctl.signal,
        onProgress: (progress) => !ctl.signal.aborted && setPhase({ kind: "running", model: t.model, progress }),
      });
      if (ctl.signal.aborted) return;
      setPhase({ kind: "preview", result, url: URL.createObjectURL(result.png) });
    } catch (e) {
      if (ctl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Background removal failed.", model: t.model });
    } finally {
      if (abort.current === ctl) abort.current = null;
    }
  };
  const cancelRun = () => {
    abort.current?.abort();
    abort.current = null;
    if (tool.current) setPhase({ kind: "confirm", model: tool.current.model });
  };
  const accept = async () => {
    if (phase.kind !== "preview") return;
    setPhase({ kind: "saving", result: phase.result, url: phase.url });
    try {
      await onAccept(phase.result);
      onClose();
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "The cut-out couldn't be saved.", model: phase.result.model });
    }
  };

  const busy = phase.kind === "running" || phase.kind === "saving";
  const smaller = (phase.kind === "preview" || phase.kind === "saving") && source.width && phase.result.width < source.width;

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog cutout-dialog" aria-describedby={undefined}>
          <Dialog.Title className="t-heading">Remove background</Dialog.Title>
          <p className="t-meta">
            {source.name}. Runs in this browser; the picture stays on this device. The result is a new picture, and the original is kept as it is.
          </p>

          {phase.kind === "checking" ? <div className="busy-line" aria-label="Checking this browser" /> : null}

          {phase.kind === "unsupported" ? (
            <p className="notice" data-tone="error" role="alert">
              {phase.reason}
            </p>
          ) : null}

          {phase.kind === "confirm" || phase.kind === "running" || (phase.kind === "error" && phase.model) ? (
            <ModelLine model={phase.kind === "error" ? phase.model! : phase.model} />
          ) : null}

          {phase.kind === "running" ? (
            <div className="cutout-progress" role="status" aria-live="polite">
              <p className="t-small">{stageText(phase.progress)}</p>
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

          {phase.kind === "preview" || phase.kind === "saving" ? (
            <>
              <div className="cutout-compare">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL or static public-domain file */}
                  {source.url ? <img src={source.url} alt="" /> : null}
                  <figcaption className="t-meta">Original</figcaption>
                </figure>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL */}
                  <img src={phase.url} alt={`${source.name} with the background removed`} className="checker" />
                  <figcaption className="t-meta">
                    Cut-out,{" "}
                    <span className="t-value">
                      {phase.result.width} × {phase.result.height} px
                    </span>
                  </figcaption>
                </figure>
              </div>
              <p className="t-small">
                {phase.result.model.name} took <span className="t-value">{(phase.result.ms.run / 1000).toFixed(1)} s</span>
                {smaller ? (
                  <>
                    {" "}
                    and returns a smaller picture than the original (<span className="t-value">{source.width} px</span> wide); check edges at full size.
                  </>
                ) : (
                  "; check the edges before using it."
                )}
              </p>
            </>
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
            {phase.kind === "confirm" || (phase.kind === "error" && phase.model) ? (
              <button type="button" className="btn btn-primary" onClick={() => void run()}>
                {phase.kind === "error" ? "Try again" : "Remove background"}
              </button>
            ) : null}
            {phase.kind === "preview" || phase.kind === "saving" ? (
              <button type="button" className="btn btn-primary" onClick={() => void accept()} disabled={phase.kind === "saving"}>
                Use the cut-out
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ModelLine({ model }: { model: ModelInfo }) {
  let host = model.source;
  try {
    host = new URL(model.source).host;
  } catch {
    /* keep the raw text */
  }
  return (
    <p className="t-small cutout-model">
      Uses {model.name} ({model.licence} licence). The first run downloads the model, about <span className="t-value">{mb(model.bytes)}</span>, from{" "}
      {/^https?:\/\//.test(model.source) ? (
        <a href={model.source} target="_blank" rel="noreferrer noopener">
          {host}
        </a>
      ) : (
        host
      )}
      ; your picture is not sent anywhere.
    </p>
  );
}
