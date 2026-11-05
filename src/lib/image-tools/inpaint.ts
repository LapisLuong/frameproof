import { validateImageBytes } from "../image/validate";
import { withBase } from "../base-path";
import { acquireImageToolSlot } from "./execution-slot";
import type { InpaintTool, ModelInfo, ToolOptions, ToolProgress, ToolResult } from "./types";

export const LAMA_MODEL: ModelInfo = {
  name: "LaMa",
  licence: "Apache-2.0",
  source: "https://huggingface.co/Carve/LaMa-ONNX/tree/c3c0c9e468934d62e79c329e35d82dd09ff8c444",
  bytes: 208_044_816,
};

const abort = () => new DOMException("Inpainting cancelled.", "AbortError");
const aborted = (signal?: AbortSignal) => { if (signal?.aborted) throw abort(); };

async function supported(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof window === "undefined" || typeof Worker === "undefined" || typeof WebAssembly === "undefined" || typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
    return { ok: false, reason: "This browser doesn't support local inpainting. Use a browser with WebAssembly, workers and OffscreenCanvas." };
  }
  if (!window.isSecureContext || !globalThis.crypto?.subtle) return { ok: false, reason: "Local inpainting requires HTTPS or localhost so the model's integrity can be checked." };
  return { ok: true };
}

async function validate(blob: Blob, label: string) {
  const bytes = new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer());
  const result = validateImageBytes(bytes, blob.size);
  if (!result.ok) throw new Error(`${label}: ${result.reason}`);
  if (label === "Mask" && result.info.kind !== "png") throw new Error("The inpainting mask must be a PNG.");
  // Two full-resolution RGBA buffers plus the model must fit in a worker. This limit is intentionally below uploads.
  if (result.info.width * result.info.height > 4_000_000) throw new Error("Local inpainting supports images up to 4 megapixels to limit memory use. Resize this image first.");
  return result.info;
}

async function inpaint(image: Blob, mask: Blob, opts: ToolOptions = {}): Promise<ToolResult> {
  aborted(opts.signal);
  const support = await supported();
  if (!support.ok) throw new Error(support.reason);
  const input = await validate(image, "Image");
  aborted(opts.signal);
  const maskInfo = await validate(mask, "Mask");
  aborted(opts.signal);
  if (input.width !== maskInfo.width || input.height !== maskInfo.height) throw new Error("The mask must have the same dimensions as the image.");
  const runtime = new URL(withBase("/image-tools/runtime/ort.webgpu.bundle.min.mjs"), window.location.origin).href;
  const wasmBase = new URL(withBase("/image-tools/runtime/"), window.location.origin).href;
  const release = acquireImageToolSlot();
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(new URL("./inpaint-worker.ts", import.meta.url), { type: "module" }); }
    catch { release(); reject(new Error("This browser couldn't start the local inpainting worker.")); return; }
    let settled = false;
    const finish = (error?: Error, result?: ToolResult) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      release();
      opts.signal?.removeEventListener("abort", cancel);
      if (error) reject(error); else if (result) resolve(result);
    };
    const cancel = () => finish(abort());
    opts.signal?.addEventListener("abort", cancel, { once: true });
    if (opts.signal?.aborted) { cancel(); return; }
    worker.onerror = () => finish(new Error("Local inpainting couldn't run. Your browser may not have enough memory; try a smaller image."));
    worker.onmessageerror = () => finish(new Error("The local inpainting worker couldn't return its result."));
    worker.onmessage = (event: MessageEvent<{ progress?: ToolProgress; result?: Omit<ToolResult, "model">; error?: string }>) => {
      if (settled) return;
      if (event.data.progress) {
        try { opts.onProgress?.(event.data.progress); } catch { /* A progress observer cannot interrupt cleanup. */ }
      } else if (event.data.error) finish(new Error(event.data.error));
      else if (event.data.result) finish(undefined, { ...event.data.result, model: LAMA_MODEL });
    };
    try { worker.postMessage({ image, mask, runtime, wasmBase }); }
    catch { finish(new Error("This image couldn't be sent to the local inpainting worker.")); }
  });
}

export const lamaTool: InpaintTool = { model: LAMA_MODEL, supported, inpaint };
export default lamaTool;
