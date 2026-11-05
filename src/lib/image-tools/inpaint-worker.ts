import { compositeInpaint, inpaintRgb } from "./inpaint-pixels";
import type { ToolProgress } from "./types";

const MODEL_BYTES = 208_044_816;
// SHA-256 from the pinned model revision's LFS object, verified through Hugging Face's model-tree API.
const MODEL_SHA256 = "1faef5301d78db7dda502fe59966957ec4b79dd64e16f03ed96913c7a4eb68d6";
const MODEL_URL = "https://huggingface.co/Carve/LaMa-ONNX/resolve/c3c0c9e468934d62e79c329e35d82dd09ff8c444/lama_fp32.onnx";
const SIDE = 512;
type Ort = typeof import("onnxruntime-web");
const progress = (p: ToolProgress) => self.postMessage({ progress: p });

async function download(): Promise<Uint8Array> {
  const response = await fetch(MODEL_URL, { cache: "force-cache", credentials: "omit", referrerPolicy: "no-referrer" });
  if (!response.ok || !response.body) throw new Error("The LaMa model couldn't be downloaded. Check the network and try again.");
  const bytes = new Uint8Array(MODEL_BYTES);
  let loaded = 0;
  const reader = response.body.getReader();
  progress({ stage: "download", loaded, total: MODEL_BYTES });
  let reportedAt = performance.now();
  let reportedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (loaded + value.byteLength > MODEL_BYTES) { await reader.cancel(); throw new Error("The LaMa model download has an unexpected size."); }
      bytes.set(value, loaded);
      loaded += value.byteLength;
      // Small network chunks must not flood the main thread with thousands of queued progress messages.
      const now = performance.now();
      if (now - reportedAt >= 100) {
        progress({ stage: "download", loaded, total: MODEL_BYTES });
        reportedAt = now;
        reportedBytes = loaded;
      }
    }
  } finally { reader.releaseLock(); }
  if (loaded !== MODEL_BYTES) throw new Error("The LaMa model download was incomplete. Try again.");
  if (reportedBytes !== loaded) progress({ stage: "download", loaded, total: MODEL_BYTES });
  if (!self.crypto?.subtle) throw new Error("Local inpainting requires a secure browser context (HTTPS or localhost).");
  const digest = await self.crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");
  if (hash !== MODEL_SHA256) throw new Error("The LaMa model failed its integrity check. Try downloading it again.");
  return bytes;
}

function context(canvas: OffscreenCanvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser couldn't prepare the inpainting canvas.");
  return ctx;
}

self.onmessage = async (event: MessageEvent<{ image: Blob; mask: Blob; runtime: string; wasmBase: string }>) => {
  let session: import("onnxruntime-web").InferenceSession | undefined;
  let source: ImageBitmap | undefined, maskBitmap: ImageBitmap | undefined;
  try {
    const start = performance.now();
    const { image, mask, runtime, wasmBase } = event.data;
    // Fixed same-origin runtime path supplied by our adapter, never by a document or connector.
    if (new URL(runtime).origin !== self.location.origin || new URL(wasmBase).origin !== self.location.origin) throw new Error("The local inpainting runtime must come from this app.");
    const ort = await import(/* webpackIgnore: true */ runtime) as Ort;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = wasmBase;
    source = await createImageBitmap(image, { imageOrientation: "none" });
    maskBitmap = await createImageBitmap(mask, { imageOrientation: "none" });
    const { width, height } = source;
    if (width !== maskBitmap.width || height !== maskBitmap.height || width * height > 4_000_000) throw new Error("The image and mask dimensions don't match or exceed the 4 megapixel inpainting limit.");
    const full = new OffscreenCanvas(width, height), fullCtx = context(full);
    fullCtx.drawImage(source, 0, 0);
    const original = fullCtx.getImageData(0, 0, width, height);
    const maskCanvas = new OffscreenCanvas(width, height), maskCtx = context(maskCanvas);
    maskCtx.drawImage(maskBitmap, 0, 0);
    const maskPixels = maskCtx.getImageData(0, 0, width, height);
    let hasMask = false;
    for (let i = 0; i < maskPixels.data.length; i += 4) if (maskPixels.data[i]! >= 128 && maskPixels.data[i + 1]! >= 128 && maskPixels.data[i + 2]! >= 128 && maskPixels.data[i + 3]! > 0) { hasMask = true; break; }
    if (!hasMask) throw new Error("Paint a white mask over the text or object to remove first.");
    // Letterbox rather than stretch: preserve source geometry through the fixed 512px model.
    const scale = Math.min(SIDE / width, SIDE / height);
    const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    const modelCanvas = new OffscreenCanvas(SIDE, SIDE), modelCtx = context(modelCanvas);
    modelCtx.fillStyle = "#000000"; modelCtx.fillRect(0, 0, SIDE, SIDE); modelCtx.drawImage(source, 0, 0, w, h);
    const input = modelCtx.getImageData(0, 0, SIDE, SIDE).data;
    const smallMask = new OffscreenCanvas(SIDE, SIDE), smallMaskCtx = context(smallMask);
    smallMaskCtx.imageSmoothingEnabled = false; smallMaskCtx.drawImage(maskBitmap, 0, 0, w, h);
    const maskInput = smallMaskCtx.getImageData(0, 0, SIDE, SIDE).data;
    const pixels = SIDE * SIDE, rgb = new Float32Array(3 * pixels), binary = new Float32Array(pixels);
    let maskCount = 0;
    for (let i = 0; i < pixels; i++) {
      for (let ch = 0; ch < 3; ch++) rgb[ch * pixels + i] = input[i * 4 + ch]! / 255;
      binary[i] = maskInput[i * 4]! >= 128 && maskInput[i * 4 + 1]! >= 128 && maskInput[i * 4 + 2]! >= 128 && maskInput[i * 4 + 3]! > 0 ? 1 : 0;
      maskCount += binary[i]!;
    }
    if (!maskCount) throw new Error("The mask is too fine for this image size. Paint a slightly wider area and try again.");
    const weights = await download();
    progress({ stage: "load" });
    session = await ort.InferenceSession.create(weights, { executionProviders: ["wasm"] });
    const load = performance.now() - start;
    progress({ stage: "run" });
    const runStart = performance.now();
    const outputs = await session.run({ image: new ort.Tensor("float32", rgb, [1, 3, SIDE, SIDE]), mask: new ort.Tensor("float32", binary, [1, 1, SIDE, SIDE]) });
    const run = performance.now() - runStart;
    const output = outputs["output"];
    if (!output || output.type !== "float32" || output.dims.join(",") !== "1,3,512,512") throw new Error("The LaMa model returned an unexpected format.");
    progress({ stage: "encode" });
    modelCtx.putImageData(new ImageData(inpaintRgb(output.data as Float32Array, pixels), SIDE, SIDE), 0, 0);
    const reconstructed = new OffscreenCanvas(width, height), reconstructedCtx = context(reconstructed);
    reconstructedCtx.drawImage(modelCanvas, 0, 0, w, h, 0, 0, width, height);
    const finalPixels = compositeInpaint(original.data, reconstructedCtx.getImageData(0, 0, width, height).data, maskPixels.data);
    fullCtx.putImageData(new ImageData(finalPixels, width, height), 0, 0);
    const png = await full.convertToBlob({ type: "image/png" });
    self.postMessage({ result: { png, width, height, ms: { load: Math.round(load), run: Math.round(run) } } });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "Local inpainting failed. Try a smaller image or another browser." });
  } finally {
    source?.close(); maskBitmap?.close(); await session?.release();
  }
};
