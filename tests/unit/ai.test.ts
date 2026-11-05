import { POST } from "@/app/api/review/route";
import { MAX_UPLOAD_BYTES } from "@/lib/image/validate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getProviderConfig, ProviderError, requestReview, type PreparedImage, type VisionProvider } from "@/lib/ai/provider";
import { AiReviewSchema, extractJson, toIssues } from "@/lib/ai/schema";

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

const img: PreparedImage = { base64: "AAAA", mime: "image/jpeg" };
const ctx = { reference: { width: 1, height: 1, palette: [] }, current: { width: 1, height: 1, palette: [] }, localFindings: [] };
const valid = {
  summary: "The title has lost its scale relative to the reference.",
  observations: [
    {
      category: "hierarchy",
      title: "Title no longer leads",
      observation: "The event name reads after the date block.",
      recommendation: "Set the title at least twice the size of the date.",
      rationale: "Passers-by need the event name first.",
      preserve: "Keep the red accent block.",
      priority: "high",
      confidence: "medium",
    },
  ],
  uncertainty: "Small text at the bottom is not legible at this resolution.",
};

function fake(replies: Array<string | Error>): VisionProvider & { calls: number } {
  return {
    id: "anthropic",
    model: "test-model",
    calls: 0,
    async complete() {
      const r = replies[this.calls++];
      if (r instanceof Error) throw r;
      return r ?? "";
    },
  };
}

describe("AI configuration", () => {
  it.each(["http://api.example.com/v1", "https://user:key@api.example.com", "https://api.example.com/v1?key=secret", "file:///tmp/api"])(
    "rejects an unsafe OpenAI-compatible endpoint without echoing it: %s",
    (base) => {
      const config = getProviderConfig(env({ AI_PROVIDER: "openai", OPENAI_API_KEY: "secret-key", AI_MODEL: "test-vision", OPENAI_BASE_URL: base }));
      expect(config).toMatchObject({ configured: false, reason: expect.stringContaining("OPENAI_BASE_URL") });
      expect(JSON.stringify(config)).not.toContain(base);
    },
  );
  it("uses the configured endpoint without following redirects", async () => {
    const config = getProviderConfig(env({ AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key", AI_MODEL: "test-vision", OPENAI_BASE_URL: "http://127.0.0.1:3210/v1/" }));
    if (!config.configured) throw new Error(config.reason);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ choices: [{ message: { content: "{}" } }] }));
    try {
      await expect(config.provider.complete("system", "brief", [img], new AbortController().signal)).resolves.toBe("{}");
      expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3210/v1/chat/completions", expect.objectContaining({ redirect: "error" }));
    } finally {
      fetchMock.mockRestore();
    }
  });
  it("is off without a provider, and explains why", () => {
    expect(getProviderConfig(env({}))).toMatchObject({ configured: false });
    expect(getProviderConfig(env({ AI_PROVIDER: "anthropic" }))).toMatchObject({ configured: false, reason: expect.stringContaining("ANTHROPIC_API_KEY") });
    expect(getProviderConfig(env({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" }))).toMatchObject({
      configured: false,
      reason: expect.stringContaining("AI_MODEL"),
    });
    expect(getProviderConfig(env({ AI_PROVIDER: "other" }))).toMatchObject({ configured: false });
  });
  it("is on with a key and never exposes the key in the result", () => {
    const c = getProviderConfig(env({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "secret-key" }));
    expect(c.configured).toBe(true);
    expect(JSON.stringify(c.configured ? { id: c.provider.id, model: c.provider.model } : c)).not.toContain("secret-key");
  });
});

describe("AI review requests", () => {
  it("parses a valid answer, even inside a code fence", async () => {
    const p = fake(["Sure:\n```json\n" + JSON.stringify(valid) + "\n```"]);
    const r = await requestReview(p, [img, img], "brief", ctx, 1000);
    expect(r.observations[0]!.title).toBe("Title no longer leads");
    expect(p.calls).toBe(1);
  });
  it("retries once on malformed output, then succeeds", async () => {
    const p = fake(["not json at all", JSON.stringify(valid)]);
    await expect(requestReview(p, [img, img], "", ctx, 1000)).resolves.toBeTruthy();
    expect(p.calls).toBe(2);
  });
  it("fails after two invalid answers instead of inventing a review", async () => {
    const p = fake([JSON.stringify({ summary: "x" }), JSON.stringify({ observations: "nope" })]);
    await expect(requestReview(p, [img, img], "", ctx, 1000)).rejects.toThrow(/format|JSON/);
  });
  it("does not retry a rejected key", async () => {
    const p = fake([new ProviderError("The API key was rejected.", 401, false), JSON.stringify(valid)]);
    await expect(requestReview(p, [img, img], "", ctx, 1000)).rejects.toThrow("The API key was rejected.");
    expect(p.calls).toBe(1);
  });
  it("labels every AI finding as ai-observed and unresolved", () => {
    const issues = toIssues(AiReviewSchema.parse(valid), "rev_1");
    expect(issues[0]).toMatchObject({ id: "rev_1:ai-1", evidenceType: "ai-observed", source: "ai", resolved: false, evidence: [] });
  });
  it("rejects a schema with extra measurement claims silently stripped", () => {
    const parsed = AiReviewSchema.parse({ ...valid, measurements: { focalPoint: [0.5, 0.5] } });
    expect("measurements" in parsed).toBe(false);
  });
  it("extractJson throws when no object is present", () => {
    expect(() => extractJson("no braces here")).toThrow();
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function configureAi() {
  vi.stubEnv("AI_PROVIDER", "anthropic");
  vi.stubEnv("ANTHROPIC_API_KEY", "unit-test-placeholder");
}

it("rejects actual multipart bodies over the cap despite a small declared length", async () => {
  configureAi();
  // Real multipart bytes, deliberately larger than the aggregate cap. No network call.
  const boundary = "frameproof-review-test";
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="unused"\r\n\r\n${"x".repeat(MAX_UPLOAD_BYTES * 2 + 256 * 1024)}\r\n--${boundary}--\r\n`;
  const req = new Request("http://localhost/api/review", {
    method: "POST",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": "1" },
    body,
  });
  const response = await POST(req);
  expect(await response.json()).toMatchObject({ error: "The request is larger than two 15 MB images." });
  expect(response.status).toBe(413);
});

it("returns malformed-context 400 for invalid JSON", async () => {
  configureAi();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const form = new FormData();
  form.set("context", "{");
  const encoded = new Request("http://localhost/api/review", { method: "POST", body: form });
  const bytes = await encoded.arrayBuffer();
  const headers = new Headers(encoded.headers);
  headers.set("content-length", String(bytes.byteLength));
  const response = await POST(new Request(encoded.url, { method: "POST", headers, body: bytes }));
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: "The measurement context was malformed." });
});

it("cancels an oversized stream before reading further chunks", async () => {
  configureAi();
  const cancel = vi.fn();
  let reads = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(MAX_UPLOAD_BYTES + 256 * 1024));
      },
      cancel,
    },
    { highWaterMark: 0 },
  );
  const request = new Request("http://localhost/api/review", {
    method: "POST",
    headers: { "content-length": "1", "content-type": "multipart/form-data; boundary=test" },
    body,
    duplex: "half",
  } as RequestInit);
  expect((await POST(request)).status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(reads).toBe(2);
});

it.each(["NaN", "Infinity", "-1", "1.5"])("rejects invalid declared length %s", async (length) => {
  configureAi();
  const request = new Request("http://localhost/api/review", { method: "POST", headers: { "content-length": length, "content-type": "multipart/form-data; boundary=test" }, body: "x" });
  expect((await POST(request)).status).toBe(413);
});
