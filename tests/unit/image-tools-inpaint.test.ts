import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compositeInpaint, inpaintRgb } from "../../src/lib/image-tools/inpaint-pixels";
import { lamaTool } from "../../src/lib/image-tools/inpaint";

describe("inpainting preserves pixels outside the mask", () => {
  it("changes white-masked RGB only and preserves every original alpha byte", () => {
    const original = new Uint8ClampedArray([20, 30, 40, 128, 50, 60, 70, 255, 80, 90, 100, 0]);
    const next = new Uint8ClampedArray([200, 200, 200, 255, 210, 210, 210, 255, 220, 220, 220, 255]);
    const mask = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0]);
    expect([...compositeInpaint(original, next, mask)]).toEqual([20, 30, 40, 128, 210, 210, 210, 255, 80, 90, 100, 0]);
    expect(original[4]).toBe(50);
  });
  it("does not treat red marks as white masks", () => {
    expect([...compositeInpaint(new Uint8ClampedArray([1, 2, 3, 4]), new Uint8ClampedArray([5, 6, 7, 8]), new Uint8ClampedArray([255, 0, 0, 255]))]).toEqual([1, 2, 3, 4]);
  });
  it("refuses dimension mismatches", () => {
    expect(() => compositeInpaint(new Uint8ClampedArray(4), new Uint8ClampedArray(8), new Uint8ClampedArray(4))).toThrow(/dimensions/);
  });
  it("converts finite CHW values, clamps channels and rejects invalid model data", () => {
    expect([...inpaintRgb([260, -2, 10.2, 40.7, 70, 80], 2)]).toEqual([255, 10, 70, 255, 0, 41, 80, 255]);
    expect(() => inpaintRgb([NaN, 1, 2], 1)).toThrow(/invalid pixels/);
    expect(() => inpaintRgb([1], 1)).toThrow(/size/);
  });
});

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  onmessageerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { TestWorker.instances.push(this); }
}

function png(width = 1, height = 1) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer); view.setUint32(16, width); view.setUint32(20, height);
  return new Blob([bytes], { type: "image/png" });
}

describe("inpainting worker lifecycle", () => {
  beforeEach(() => {
    TestWorker.instances = [];
    vi.stubGlobal("window", { isSecureContext: true, location: { origin: "http://localhost" } });
    vi.stubGlobal("Worker", TestWorker);
    vi.stubGlobal("OffscreenCanvas", class {});
    vi.stubGlobal("createImageBitmap", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects pre-cancelled input before a worker is allocated", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(lamaTool.inpaint(png(), png(), { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(TestWorker.instances).toHaveLength(0);
  });
  it("terminates a running worker on cancellation and releases the shared slot", async () => {
    const controller = new AbortController();
    const running = lamaTool.inpaint(png(), png(), { signal: controller.signal });
    const rejection = expect(running).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
    controller.abort(); await rejection;
    expect(TestWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    const next = lamaTool.inpaint(png(), png());
    const failure = expect(next).rejects.toThrow(/couldn't return/);
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(2));
    TestWorker.instances[1]!.onmessageerror?.(); await failure;
    expect(TestWorker.instances[1]!.terminate).toHaveBeenCalledOnce();
  });
  it("finishes successfully, terminates the worker and ignores a throwing progress observer", async () => {
    const running = lamaTool.inpaint(png(), png(), { onProgress: () => { throw new Error("observer failed"); } });
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
    const worker = TestWorker.instances[0]!;
    worker.onmessage?.({ data: { progress: { stage: "run" } } });
    worker.onmessage?.({ data: { result: { png: png(), width: 1, height: 1, ms: { load: 2, run: 3 } } } });
    expect((await running).model.name).toBe("LaMa");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("rejects mismatched dimensions and invalid magic before allocating model memory", async () => {
    await expect(lamaTool.inpaint(png(), png(2, 1))).rejects.toThrow(/same dimensions/);
    await expect(lamaTool.inpaint(new Blob(["wrong"]), png())).rejects.toThrow(/isn't a PNG/);
    await expect(lamaTool.inpaint(png(2001, 2000), png(2001, 2000))).rejects.toThrow(/4 megapixels/);
    expect(TestWorker.instances).toHaveLength(0);
  });
});
