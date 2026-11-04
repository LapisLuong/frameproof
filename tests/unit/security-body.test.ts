import { afterEach, expect, it, vi } from "vitest";
import { BodyReadError, readBodyBytes } from "../../src/lib/security/body";

afterEach(() => vi.useRealTimers());
function streamed(body: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  return new Request("http://localhost/api/review", { method: "POST", body, signal, duplex: "half" } as RequestInit);
}
it("reads bounded chunks exactly", async () => {
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.enqueue(new Uint8Array([3])); c.close(); } });
  expect(await readBodyBytes(streamed(stream), 3)).toEqual(new Uint8Array([1, 2, 3]));
});
it("cancels on the real byte limit even if a declared length lies", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(4)); }, cancel }, { highWaterMark: 0 });
  await expect(readBodyBytes(streamed(stream), 3)).rejects.toMatchObject({ status: 413 });
  expect(cancel).toHaveBeenCalledOnce();
});
it("times out a stalled stream and releases its reader without waiting for cancel", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const stream = new ReadableStream<Uint8Array>({ cancel });
  const result = readBodyBytes(streamed(stream), 10, 1000);
  const assertion = expect(result).rejects.toMatchObject({ status: 408 });
  await vi.advanceTimersByTimeAsync(1000);
  await assertion;
  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});
it("cancels immediately when the caller aborts", async () => {
  const controller = new AbortController();
  const cancel = vi.fn();
  const result = readBodyBytes(streamed(new ReadableStream<Uint8Array>({ cancel }), controller.signal), 10);
  const assertion = expect(result).rejects.toBeInstanceOf(BodyReadError);
  controller.abort();
  await assertion;
  expect(cancel).toHaveBeenCalledOnce();
});
