import { describe, expect, it } from "vitest";
import { readDimensions, sniffKind, validateImageBytes, MAX_UPLOAD_BYTES } from "@/lib/image/validate";
import { analyzeBuffer, compareBuffers, stripDiff } from "@/lib/analysis/analyze";
import { createBuffer, fillRect } from "@/lib/analysis/pixels";
import { buildLocalIssues, paletteDrift } from "@/lib/review/engine";
import { ReviewIssueSchema, sortIssues, type ReviewIssue } from "@/lib/review/types";

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

describe("upload validation", () => {
  it("sniffs by content, not extension", () => {
    expect(sniffKind(png(1, 1))).toBe("png");
    expect(sniffKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffKind(new TextEncoder().encode("GIF89a.."))).toBe("gif");
    expect(sniffKind(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffKind(new TextEncoder().encode("<svg xmlns="))).toBeNull();
  });
  it("reads PNG dimensions from IHDR", () => {
    expect(readDimensions(png(1080, 1350), "png")).toEqual({ width: 1080, height: 1350 });
  });
  it("reads JPEG dimensions from SOF0 after an APP0 segment", () => {
    const j = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0, 0, 0, 0, 0]);
    expect(readDimensions(j, "jpeg")).toEqual({ width: 800, height: 600 });
  });
  it("rejects bombs, oversize files, unknown formats and empty files", () => {
    expect(validateImageBytes(png(20000, 20000), 1000).ok).toBe(false);
    expect(validateImageBytes(png(100, 100), MAX_UPLOAD_BYTES + 1).ok).toBe(false);
    expect(validateImageBytes(new TextEncoder().encode("hello world!"), 12).ok).toBe(false);
    expect(validateImageBytes(new Uint8Array(), 0).ok).toBe(false);
    const ok = validateImageBytes(png(1200, 1600), 5000);
    expect(ok.ok && ok.info).toEqual({ kind: "png", width: 1200, height: 1600 });
  });
});

function poster(opts: { ground: [number, number, number]; title: [number, number, number]; titleH: number; titleY: number; clutter?: boolean; w?: number; h?: number }) {
  const w = opts.w ?? 200;
  const h = opts.h ?? 250;
  const b = createBuffer(w, h, [...opts.ground, 255]);
  fillRect(b, 20, opts.titleY, w - 40, opts.titleH, [...opts.title, 255]);
  if (opts.clutter) for (let y = 120; y < h - 10; y += 6) fillRect(b, 20, y, w - 40, 2, [...opts.title, 255]);
  return { buf: b, meta: { width: w, height: h, bytes: 1000, kind: "png" } };
}

describe("review engine", () => {
  const ref = poster({ ground: [246, 244, 239], title: [198, 90, 66], titleH: 70, titleY: 20 });

  it("produces no comparative findings when the design matches the reference", () => {
    const A = analyzeBuffer(ref.buf, ref.meta);
    const cmp = stripDiff(compareBuffers(ref.buf, ref.buf, ref.meta, ref.meta));
    // Only the absolute accessibility check may fire: #C65A42 on #F6F4EF is 3.86:1.
    const issues = buildLocalIssues({ reference: A, current: A, comparison: cmp }, "r1");
    expect(issues.map((i) => i.id)).toEqual(["r1:palette-contrast"]);
    const ink = poster({ ground: [246, 244, 239], title: [32, 35, 35], titleH: 70, titleY: 20 });
    const I = analyzeBuffer(ink.buf, ink.meta);
    const c2 = stripDiff(compareBuffers(ink.buf, ink.buf, ink.meta, ink.meta));
    expect(buildLocalIssues({ reference: I, current: I, comparison: c2 }, "r1b")).toEqual([]);
  });

  it("flags a low-contrast, cluttered, reformatted variation with explained, schema-valid issues", () => {
    const cur = poster({ ground: [200, 200, 205], title: [160, 160, 170], titleH: 20, titleY: 100, clutter: true, w: 200, h: 200 });
    const A = analyzeBuffer(ref.buf, ref.meta);
    const B = analyzeBuffer(cur.buf, cur.meta);
    const cmp = stripDiff(compareBuffers(ref.buf, cur.buf, ref.meta, cur.meta));
    const issues = buildLocalIssues({ reference: A, current: B, comparison: cmp }, "r2");
    const rules = issues.map((i) => i.id.split(":")[1]);
    expect(rules).toContain("aspect");
    expect(rules).toContain("palette-drift");
    expect(rules).toContain("palette-contrast");
    for (const i of issues) {
      expect(ReviewIssueSchema.safeParse(i).success).toBe(true);
      expect(i.observation.length).toBeGreaterThan(20);
      expect(i.recommendation.length).toBeGreaterThan(20);
      expect(i.rationale.length).toBeGreaterThan(20);
      expect(i.source).toBe("local");
      expect(i.evidenceType).not.toBe("ai-observed");
    }
    // high priority first
    expect(issues[0]!.priority).toBe("high");
  });

  it("flags a saturated teal that only 'matches' a reference grey", () => {
    const refP = poster({ ground: [244, 241, 234], title: [140, 139, 136], titleH: 60, titleY: 20 });
    const curP = poster({ ground: [244, 241, 234], title: [47, 140, 140], titleH: 60, titleY: 20 });
    const A = analyzeBuffer(refP.buf, refP.meta);
    const B = analyzeBuffer(curP.buf, curP.meta);
    const cmp = stripDiff(compareBuffers(refP.buf, curP.buf, refP.meta, curP.meta));
    const ids = buildLocalIssues({ reference: A, current: B, comparison: cmp }, "t").map((i) => i.id);
    expect(ids.some((id) => id.startsWith("t:new-color-"))).toBe(true);
  });

  it("palette drift is zero for identical palettes", () => {
    const s = [{ hex: "#C65A42", share: 1, chroma: 0.13, L: 0.6 }];
    expect(paletteDrift(s, s)).toBe(0);
  });

  it("sorts by priority, then confidence, then evidence", () => {
    const base = { title: "t", observation: "o", recommendation: "r", rationale: "x", preserve: "", evidence: [], source: "local" as const, resolved: false, category: "layout" as const };
    const list: ReviewIssue[] = [
      { ...base, id: "a", priority: "low", confidence: "high", evidenceType: "measured" },
      { ...base, id: "b", priority: "high", confidence: "low", evidenceType: "ai-observed" },
      { ...base, id: "c", priority: "high", confidence: "low", evidenceType: "measured" },
    ];
    expect(sortIssues(list).map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
});
