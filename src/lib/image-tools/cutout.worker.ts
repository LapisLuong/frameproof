import { BEN2_MODEL, BEN2_REVISION, CUTOUT_MAX_SIDE, CUTOUT_OUTPUT_MAX_SIDE, type CutoutMessage, type CutoutRequest } from "./cutout-protocol";
import type { ToolProgress } from "./types";

type RawImage = { width: number; height: number; channels: number; data: Uint8Array | Uint8ClampedArray; rgba(): RawImage; split(): RawImage[]; resize(w: number, h: number): Promise<RawImage>; toBlob(type?: string): Promise<Blob> };
type Pipeline = { (input: RawImage): Promise<RawImage>; dispose(): Promise<void> };
type Runtime = {
  env: { allowLocalModels: boolean; allowRemoteModels: boolean; useBrowserCache: boolean; remotePathTemplate: string; backends: { onnx: { wasm: { numThreads: number; wasmPaths: string } } } };
  RawImage: { fromBlob(blob: Blob): Promise<RawImage> };
  pipeline(task: string, model: string, options: { device: string; dtype: string; revision: string; progress_callback: (event: { status?: string; loaded?: number; total?: number }) => void }): Promise<Pipeline>;
};
const send = (msg: CutoutMessage) => self.postMessage(msg);
const progress = (value: ToolProgress) => send({ type: "progress", progress: value });

self.onmessage = async (event: MessageEvent<CutoutRequest>) => {
  // One image per worker. The owner terminates this worker for cancellation, failure and completion, freeing WASM.
  self.onmessage = null;
  let segmenter: Pipeline | undefined;
  try {
    const { image, runtimeUrl, wasmBase } = event.data;
    if (new URL(runtimeUrl).origin !== self.location.origin || new URL(wasmBase).origin !== self.location.origin) {
      throw new Error("The model runtime must be hosted by FrameProof.");
    }
    const began = performance.now();
    progress({ stage: "load" });
    const runtime = await import(/* webpackIgnore: true */ runtimeUrl) as Runtime;
    runtime.env.allowLocalModels = false;
    runtime.env.allowRemoteModels = true;
    runtime.env.useBrowserCache = true;
    // Transformers 4.3.2 probes main before its revision-aware load. Pin the path too, so even that probe is immutable.
    runtime.env.remotePathTemplate = `{model}/resolve/${BEN2_REVISION}/`;
    runtime.env.backends.onnx.wasm.numThreads = 1;
    runtime.env.backends.onnx.wasm.wasmPaths = wasmBase;
    let lastDownloadProgress = 0;
    segmenter = await runtime.pipeline("background-removal", "onnx-community/BEN2-ONNX", {
      device: "wasm", dtype: "fp16", revision: BEN2_REVISION,
      progress_callback: (p) => {
        if (p.status === "progress" && typeof p.loaded === "number") {
          const now = performance.now();
          // Large weights arrive in many tiny chunks. Keep the UI responsive without inventing a percentage.
          if (now - lastDownloadProgress >= 100 || p.loaded === p.total) {
            lastDownloadProgress = now;
            progress({ stage: "download", loaded: p.loaded, total: typeof p.total === "number" ? p.total : null });
          }
        }
      },
    });
    const original = await runtime.RawImage.fromBlob(image);
    const ratio = Math.min(1, CUTOUT_MAX_SIDE / Math.max(original.width, original.height));
    const input = ratio < 1 ? await original.resize(Math.max(1, Math.round(original.width * ratio)), Math.max(1, Math.round(original.height * ratio))) : original;
    const loaded = performance.now();
    progress({ stage: "run" });
    const result = await segmenter(input);
    if (result.channels !== 4) throw new Error("The model did not return a transparent image.");
    const ran = performance.now();
    progress({ stage: "encode" });
    // Resize only the predicted alpha onto source RGB; do not upscale the low-resolution model's RGB.
    const outputRatio = Math.min(1, CUTOUT_OUTPUT_MAX_SIDE / Math.max(original.width, original.height));
    const source = (outputRatio < 1 ? await original.resize(Math.max(1, Math.round(original.width * outputRatio)), Math.max(1, Math.round(original.height * outputRatio))) : original).rgba();
    const alpha = await result.split()[3]!.resize(source.width, source.height);
    for (let i = 0; i < source.width * source.height; i++) {
      source.data[i * 4 + 3] = Math.round(source.data[i * 4 + 3]! * alpha.data[i]! / 255);
    }
    const png = await source.toBlob("image/png");
    send({ type: "result", result: { png, width: source.width, height: source.height, model: BEN2_MODEL, ms: { load: Math.round(loaded - began), run: Math.round(ran - loaded) } } });
  } catch (error) {
    console.error("BEN2 runtime failed", error);
    send({ type: "error", error: "BEN2 could not load or process this image. Check the model download, available memory and browser support, then try again." });
  } finally {
    await segmenter?.dispose();
  }
};
