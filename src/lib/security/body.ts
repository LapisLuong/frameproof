export class BodyReadError extends Error {
  constructor(message: string, readonly status: 408 | 413) {
    super(message);
    this.name = "BodyReadError";
  }
}

/** Bound both memory and wall time before multipart parsing. Headers alone are not trusted. */
export async function readBodyBytes(req: Pick<Request, "body" | "signal">, cap: number, timeoutMs = 30_000): Promise<Uint8Array<ArrayBuffer>> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array(0);
  let fail: (error: Error) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { fail = reject; });
  const abort = () => fail(new BodyReadError("The upload was cancelled.", 408));
  const timer = setTimeout(() => fail(new BodyReadError("The upload took too long. Try a smaller image or a steadier connection.", 408)), timeoutMs);
  req.signal.addEventListener("abort", abort, { once: true });
  if (req.signal.aborted) abort();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), interrupted]);
      if (done) break;
      size += value.byteLength;
      if (size > cap) throw new BodyReadError("The upload is larger than the allowed request size.", 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    // Cancellation must not await a stalled producer's cancel hook.
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    req.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
