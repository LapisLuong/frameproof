import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cutoutTool } from "../../src/lib/image-tools/cutout";
import { BEN2_MODEL, BEN2_REVISION, type CutoutMessage } from "../../src/lib/image-tools/cutout-protocol";

class WorkerStub {
  static instances: WorkerStub[] = [];
  onmessage: ((event: { data: CutoutMessage }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { WorkerStub.instances.push(this); }
  send(data: CutoutMessage) { this.onmessage?.({ data }); }
}
const pngHeader = () => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  bytes[19] = 1; bytes[23] = 1;
  return new Blob([bytes], { type: "image/png" });
};
const started = async () => {
  for (let i = 0; i < 20 && !WorkerStub.instances.length; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  expect(WorkerStub.instances).toHaveLength(1);
  return WorkerStub.instances[0]!;
};

beforeEach(() => {
  WorkerStub.instances = [];
  vi.stubGlobal("window", { location: { origin: "https://frameproof.example" } });
  vi.stubGlobal("Worker", WorkerStub);
  vi.stubGlobal("OffscreenCanvas", class {});
});
afterEach(() => vi.unstubAllGlobals());

describe("cutout worker lifecycle (no model inference in these unit tests)", () => {
  it("reports unsupported environments without downloading", async () => {
    vi.stubGlobal("Worker", undefined);
    expect((await cutoutTool.supported()).ok).toBe(false);
    expect(WorkerStub.instances).toHaveLength(0);
  });
  it("rejects invalid images before starting the worker", async () => {
    await expect(cutoutTool.removeBackground(new Blob(["not an image"]))).rejects.toThrow();
    expect(WorkerStub.instances).toHaveLength(0);
  });
  it("rejects an already-cancelled request before starting", async () => {
    const signal = AbortSignal.abort();
    await expect(cutoutTool.removeBackground(pngHeader(), { signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(WorkerStub.instances).toHaveLength(0);
  });
  it("hard-terminates a running worker on cancellation, and ignores a late result", async () => {
    const controller = new AbortController();
    const pending = cutoutTool.removeBackground(pngHeader(), { signal: controller.signal });
    const worker = await started();
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    worker.send({ type: "error", error: "late error" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("allows only one memory-heavy job at a time", async () => {
    const controller = new AbortController();
    const pending = cutoutTool.removeBackground(pngHeader(), { signal: controller.signal });
    const worker = await started();
    await expect(cutoutTool.removeBackground(pngHeader())).rejects.toThrow("already running");
    expect(WorkerStub.instances).toHaveLength(1);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("returns the actual model PNG and dimensions, forwards progress and frees the worker", async () => {
    const onProgress = vi.fn();
    const pending = cutoutTool.removeBackground(pngHeader(), { onProgress });
    const worker = await started();
    worker.send({ type: "progress", progress: { stage: "run" } });
    const result = { png: new Blob(["test-result"], { type: "image/png" }), width: 456, height: 512, model: BEN2_MODEL, ms: { load: 10, run: 20 } };
    worker.send({ type: "result", result });
    expect(await pending).toBe(result);
    expect(onProgress).toHaveBeenCalledWith({ stage: "run" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.postMessage.mock.calls[0]?.[0]).toMatchObject({ runtimeUrl: "https://frameproof.example/image-tools/runtime/transformers.web.js" });
  });
  it("rejects model failures without returning a pretend cutout", async () => {
    const pending = cutoutTool.removeBackground(pngHeader());
    const worker = await started();
    worker.send({ type: "error", error: "Model could not load" });
    await expect(pending).rejects.toThrow("Model could not load");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("releases the shared memory slot when worker construction fails", async () => {
    vi.stubGlobal("Worker", class { constructor() { throw new Error("Blocked worker"); } });
    await expect(cutoutTool.removeBackground(pngHeader())).rejects.toThrow("could not start");
    vi.stubGlobal("Worker", WorkerStub);
    const pending = cutoutTool.removeBackground(pngHeader());
    const worker = await started();
    worker.send({ type: "error", error: "Stopped test" });
    await expect(pending).rejects.toThrow("Stopped test");
  });
  it("pins the model source to an immutable revision", () => {
    expect(BEN2_REVISION).toMatch(/^[a-f0-9]{40}$/);
    expect(BEN2_MODEL.source).toContain(BEN2_REVISION);
  });
});
