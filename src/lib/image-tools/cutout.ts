import { withBase } from "../base-path";
import { validateImageBytes } from "../image/validate";
import { BEN2_MODEL, type CutoutMessage, type CutoutRequest } from "./cutout-protocol";
import { acquireImageToolSlot } from "./execution-slot";
import type { CutoutTool, ToolOptions, ToolResult } from "./types";

const aborted = () => new DOMException("Background removal was cancelled.", "AbortError");

export const cutoutTool: CutoutTool = {
  model: BEN2_MODEL,
  async supported() {
    if (typeof window === "undefined" || typeof Worker === "undefined" || typeof WebAssembly === "undefined" || typeof OffscreenCanvas === "undefined") {
      return { ok: false, reason: "Background removal needs a browser with Web Workers, WebAssembly and OffscreenCanvas." };
    }
    return { ok: true };
  },
  async removeBackground(image: Blob, opts: ToolOptions = {}): Promise<ToolResult> {
    const release = acquireImageToolSlot();
    try {
      if (opts.signal?.aborted) throw aborted();
      const support = await this.supported();
      if (!support.ok) throw new Error(support.reason);
      const header = new Uint8Array(await image.slice(0, 256 * 1024).arrayBuffer());
      if (opts.signal?.aborted) throw aborted();
      const valid = validateImageBytes(header, image.size);
      if (!valid.ok) throw new Error(valid.reason);
      const runtimeUrl = new URL(withBase("/image-tools/runtime/transformers.web.js"), window.location.origin).href;
      const wasmBase = new URL(withBase("/image-tools/runtime/"), window.location.origin).href;
      return await new Promise((resolve, reject) => {
        let worker: Worker;
        let settled = false;
        const finish = (error?: Error, result?: ToolResult) => {
          if (settled) return;
          settled = true;
          opts.signal?.removeEventListener("abort", cancel);
          worker?.terminate();
          if (error) reject(error);
          else if (result) resolve(result);
        };
        const cancel = () => finish(aborted());
        try {
          worker = new Worker(new URL("./cutout.worker.ts", import.meta.url), { type: "module" });
          worker.onmessage = (event: MessageEvent<CutoutMessage>) => {
            const msg = event.data;
            if (msg.type === "progress") {
              try { opts.onProgress?.(msg.progress); } catch { finish(new Error("The progress display failed.")); }
            } else if (msg.type === "error") finish(new Error(msg.error));
            else if (msg.type === "result") finish(undefined, msg.result);
          };
          worker.onerror = () => finish(new Error("The background-removal worker could not run. Try a recent browser or a smaller image."));
          worker.onmessageerror = () => finish(new Error("The background-removal result could not be read."));
          opts.signal?.addEventListener("abort", cancel, { once: true });
          if (opts.signal?.aborted) return cancel();
          worker.postMessage({ image, runtimeUrl, wasmBase } satisfies CutoutRequest);
        } catch {
          finish(new Error("Background removal could not start in this browser."));
        }
      });
    } finally {
      release();
    }
  },
};

export default cutoutTool;
