import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requestReview, type PreparedImage, type VisionProvider } from "@/lib/ai/provider";
import { AiReviewSchema, toIssues } from "@/lib/ai/schema";
import { ReviewIssueSchema } from "@/lib/review/types";

/**
 * A real model answer, recorded once with `node scripts/record-ai-fixture.mjs` against a local server that had a key.
 * It lets these tests check real output without a key or a network call, in CI too. Until it has been recorded the
 * suite is skipped, and the skip says how to record it.
 */
const FILE = "tests/fixtures/ai-review.json";
const recorded = existsSync(FILE);
const raw = recorded ? readFileSync(FILE, "utf8") : "";
const fixture = recorded ? (JSON.parse(raw) as { recordedAt: string; provider: string; model: string; review: unknown }) : null;

const img: PreparedImage = { base64: "AAAA", mime: "image/jpeg" };
const ctx = { reference: { width: 1240, height: 1754, palette: [] }, current: { width: 1080, height: 1350, palette: [] }, localFindings: [] };
const replying = (text: string): VisionProvider => ({ id: "openai", model: "recorded", complete: async () => text });

describe.skipIf(!recorded)(`recorded AI review (${recorded ? FILE : "not recorded yet: run scripts/record-ai-fixture.mjs"})`, () => {
  it("says where it came from and holds no credential", () => {
    expect(fixture!.provider).toMatch(/^(anthropic|openai)$/);
    expect(fixture!.model.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(fixture!.recordedAt))).toBe(false);
    // Shapes of Google, OpenAI and Anthropic keys, and any field that would carry one.
    expect(raw).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9_-]{20,}|"(api_?key|authorization|x-api-key)"/i);
  });

  it("is a valid review as recorded, with nothing the schema would have to strip", () => {
    const parsed = AiReviewSchema.parse(fixture!.review);
    expect(parsed).toEqual(fixture!.review);
    expect(parsed.observations.length).toBeGreaterThan(0);
  });

  it("goes through the provider path unchanged, as plain JSON and inside a code fence", async () => {
    const json = JSON.stringify(fixture!.review);
    await expect(requestReview(replying(json), [img, img], "brief", ctx, 1000)).resolves.toEqual(fixture!.review);
    await expect(requestReview(replying(`Here is the review:\n\`\`\`json\n${json}\n\`\`\``), [img, img], "", ctx, 1000)).resolves.toEqual(fixture!.review);
  });

  it("becomes AI-observed notes only: no measured evidence, no location on the artwork", () => {
    const issues = toIssues(AiReviewSchema.parse(fixture!.review), "rev_fixture");
    issues.forEach((issue, i) => {
      expect(ReviewIssueSchema.parse(issue)).toBeTruthy();
      expect(issue).toMatchObject({ id: `rev_fixture:ai-${i + 1}`, evidenceType: "ai-observed", source: "ai", resolved: false, evidence: [] });
      expect(issue.anchors).toBeUndefined();
    });
  });
});
