"use client";

import type { ModelInfo, ToolProgress } from "@/lib/image-tools/types";

/** Pieces shared by the image-tool dialogs (background removal, filling an area). */

export const mb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`;

export function stageText(p: ToolProgress | null, run = "Finding the subject…"): string {
  if (!p) return "Starting…";
  if (p.stage === "download") return p.total ? `Downloading the model: ${mb(p.loaded)} of ${mb(p.total)}` : `Downloading the model: ${mb(p.loaded)}`;
  if (p.stage === "load") return "Loading the model…";
  if (p.stage === "run") return run;
  return "Preparing the result…";
}

export function ModelLine({ model }: { model: ModelInfo }) {
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
