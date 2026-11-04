import { describe, expect, it } from "vitest";
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
  it("is off without a provider, and explains why", () => {
    expect(getProviderConfig(env({}))).toMatchObject({ configured: false });
    expect(getProviderConfig(env({ AI_PROVIDER: "anthropic" }))).toMatchObject({ configured: false, reason: expect.stringContaining("ANTHROPIC_API_KEY") });
    expect(getProviderConfig(env({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" }))).toMatchObject({ configured: false, reason: expect.stringContaining("AI_MODEL") });
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
