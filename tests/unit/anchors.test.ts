import { describe, expect, it } from "vitest";
import { analyzeBuffer, compareBuffers, stripDiff } from "@/lib/analysis/analyze";
import { createBuffer, fillRect } from "@/lib/analysis/pixels";
import { AiReviewSchema, toIssues } from "@/lib/ai/schema";
import { buildLocalIssues } from "@/lib/review/engine";
import { reviewToMarkdown } from "@/lib/review/report";
import { hasAnchors, noteNumber, ReviewIssueSchema } from "@/lib/review/types";
import type { Project, Review } from "@/lib/store/models";

function poster(titleY: number) {
  const w = 200;
  const h = 250;
  const b = createBuffer(w, h, [246, 244, 239, 255]);
  fillRect(b, 20, titleY, w - 40, 50, [32, 35, 35, 255]);
  return { buf: b, meta: { width: w, height: h, bytes: 1000, kind: "png" } };
}

function moved() {
  const ref = poster(20);
  const cur = poster(170);
  const R = analyzeBuffer(ref.buf, ref.meta);
  const C = analyzeBuffer(cur.buf, cur.meta);
  const comparison = stripDiff(compareBuffers(ref.buf, cur.buf, ref.meta, cur.meta));
  return { R, C, issues: buildLocalIssues({ reference: R, current: C, comparison }, "r1") };
}

describe("finding anchors", () => {
  it("places one measured anchor per image on the centre-of-detail finding", () => {
    const { R, C, issues } = moved();
    const centroid = issues.find((i) => i.id === "r1:centroid");
    expect(centroid).toBeDefined();
    expect(centroid!.evidenceType).toBe("measured");
    expect(ReviewIssueSchema.safeParse(centroid).success).toBe(true);
    const [a, b] = centroid!.anchors!;
    expect(a).toMatchObject({ image: "reference", x: R.structure.detailCentroid.x, y: R.structure.detailCentroid.y });
    expect(b).toMatchObject({ image: "current", x: C.structure.detailCentroid.x, y: C.structure.detailCentroid.y });
    for (const p of [a!, b!]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    expect(b!.y).toBeGreaterThan(a!.y);
  });

  it("gives whole-image findings no anchors", () => {
    const { issues } = moved();
    for (const i of issues.filter((x) => x.id !== "r1:centroid")) expect(hasAnchors(i)).toBe(false);
  });

  it("numbers notes by their position in priority order", () => {
    const { issues } = moved();
    issues.forEach((i, n) => expect(noteNumber(issues, i)).toBe(n + 1));
  });

  it("never lets a model place an anchor", () => {
    const reply = {
      summary: "The headline has moved to the bottom of the poster.",
      observations: [
        {
          category: "layout",
          title: "Headline moved down",
          observation: "The headline now sits near the bottom edge.",
          recommendation: "Move the headline back to the top third.",
          rationale: "The reference leads with the headline.",
          priority: "medium",
          confidence: "medium",
          anchors: [{ image: "current", x: 0.5, y: 0.9, label: "Headline" }],
        },
      ],
    };
    const issues = toIssues(AiReviewSchema.parse(reply), "rev");
    expect(issues[0]!.evidenceType).toBe("ai-observed");
    expect(hasAnchors(issues[0]!)).toBe(false);
  });

  it("accepts reviews saved before anchors existed", () => {
    const { issues } = moved();
    const { anchors: _drop, ...old } = issues.find((i) => i.id === "r1:centroid")!;
    expect(ReviewIssueSchema.safeParse(old).success).toBe(true);
  });

  it("writes a location line only for anchored notes in the revision brief", () => {
    const { R, C, issues } = moved();
    const project = { id: "p", name: "Poster", brief: "" } as Project;
    const review = {
      id: "r1",
      projectId: "p",
      version: 1,
      createdAt: 0,
      referenceAssetId: "a",
      currentAssetId: "b",
      measurements: { reference: R, current: C, comparison: stripDiff(compareBuffers(poster(20).buf, poster(170).buf, R, C)) },
      issues,
      ai: { state: "skipped" },
      notes: "",
    } as Review;
    const md = reviewToMarkdown(project, review);
    expect(md.match(/\*\*Location:\*\*/g)?.length).toBe(1);
    expect(md).toMatch(/\*\*Location:\*\* reference \d+% across, \d+% down; current \d+% across, \d+% down/);
  });
});
