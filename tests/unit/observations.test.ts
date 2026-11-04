import { describe, expect, it } from "vitest";
import { analyzeBuffer } from "@/lib/analysis/analyze";
import type { PixelBuffer } from "@/lib/analysis/pixels";
import { CONCENTRATED_DETAIL, observeImage, observationsToMarkdown } from "@/lib/review/observations";
import { THRESHOLDS } from "@/lib/review/engine";

type RGBA = [number, number, number, number];

/** A canvas filled with `bg`, with optional rectangles (fractions of the frame) painted on top. */
function paint(w: number, h: number, bg: RGBA, rects: Array<{ x0: number; y0: number; x1: number; y1: number; c: RGBA; stripes?: boolean }> = []): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = bg;
      for (const r of rects) {
        const inside = x >= r.x0 * w && x < r.x1 * w && y >= r.y0 * h && y < r.y1 * h;
        if (inside && (!r.stripes || Math.floor(x / 2) % 2 === 0)) c = r.c;
      }
      data.set(c, (y * w + x) * 4);
    }
  return { width: w, height: h, data };
}
const meta = (w: number, h: number) => ({ width: w, height: h, bytes: 1000, kind: "png" });
const byId = (obs: ReturnType<typeof observeImage>, id: string) => obs.find((o) => o.id === id);

describe("observeImage", () => {
  const paper: RGBA = [244, 241, 234, 255];
  const red: RGBA = [198, 90, 66, 255];
  const ink: RGBA = [20, 20, 20, 255];

  it("restates measured values only, with evidence and never an AI evidence type", () => {
    const a = analyzeBuffer(paint(400, 500, paper, [{ x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.4, c: red }]), meta(400, 500));
    const obs = observeImage(a);
    expect(obs.map((o) => o.id)).toEqual(["format", "largest-colour", "strong-colour", "contrast", "detail", "quiet"]);
    for (const o of obs) {
      expect(["measured", "estimated"]).toContain(o.evidenceType);
      expect(o.evidence.length).toBeGreaterThan(0);
    }
    expect(byId(obs, "format")!.detail).toContain("400×500 px PNG");
    expect(byId(obs, "quiet")!.evidenceType).toBe("estimated");
    // Same numbers as the analysis: the largest colour is the paper, and it is reported with its share.
    expect(byId(obs, "largest-colour")!.detail).toContain(a.palette.swatches[0]!.hex);
  });

  it("names a strong colour by the review's accent threshold, or says there is none", () => {
    const withRed = observeImage(analyzeBuffer(paint(200, 200, paper, [{ x0: 0, y0: 0, x1: 0.5, y1: 0.5, c: red }]), meta(200, 200)));
    expect(byId(withRed, "strong-colour")!.title).toMatch(/strong colour/);
    expect(byId(withRed, "strong-colour")!.detail).toContain("chroma");
    const grey = observeImage(analyzeBuffer(paint(200, 200, [200, 200, 200, 255], [{ x0: 0, y0: 0, x1: 0.5, y1: 1, c: [90, 90, 90, 255] }]), meta(200, 200)));
    expect(byId(grey, "strong-colour")!.title).toBe("No strong colour");
    expect(byId(grey, "strong-colour")!.detail).toContain(String(THRESHOLDS.accentChroma));
  });

  it("reports the strongest main pair against 4.5:1 and says it can't see text", () => {
    const low = observeImage(analyzeBuffer(paint(200, 200, paper, [{ x0: 0, y0: 0, x1: 1, y1: 0.4, c: red }]), meta(200, 200)));
    expect(byId(low, "contrast")!.title).toBe("No main colour pair reaches 4.5:1");
    expect(byId(low, "contrast")!.limit).toMatch(/text/);
    const high = observeImage(analyzeBuffer(paint(200, 200, paper, [{ x0: 0, y0: 0, x1: 1, y1: 0.4, c: ink }]), meta(200, 200)));
    expect(byId(high, "contrast")!.title).toMatch(/^A main colour pair reaches/);
  });

  it("says where detail gathers only when one ninth holds at least twice an even share", () => {
    const corner = analyzeBuffer(paint(300, 300, paper, [{ x0: 0, y0: 0, x1: 0.33, y1: 0.33, c: ink, stripes: true }]), meta(300, 300));
    const obs = byId(observeImage(corner), "detail")!;
    expect(Math.max(...corner.structure.detailGrid)).toBeGreaterThanOrEqual(CONCENTRATED_DETAIL);
    expect(obs.title).toBe("Detail gathers in the top left");
    const even = analyzeBuffer(paint(300, 300, paper, [{ x0: 0, y0: 0, x1: 1, y1: 1, c: ink, stripes: true }]), meta(300, 300));
    expect(byId(observeImage(even), "detail")!.title).toBe("Detail is spread across the frame");
  });

  it("claims no detail position for a solid image (the centre and ninths are only defaults there)", () => {
    const solid = analyzeBuffer(paint(300, 200, paper), meta(300, 200));
    expect(solid.structure.edgeDensity).toBe(0);
    const obs = observeImage(solid);
    const detail = byId(obs, "detail")!;
    expect(detail.title).toBe("No edges to locate");
    expect(detail.detail).not.toMatch(/ninth|across|down|spread/);
    expect(detail.evidence.map((e) => e.label)).toEqual(["Edge density"]);
    const md = observationsToMarkdown(obs).join("\n");
    expect(md).toContain("### No edges to locate");
    expect(md).not.toMatch(/Detail is spread|Detail gathers|Densest ninth|Detail centre/);
  });

  it("says a fully transparent image has no opaque pixels instead of calling its colour neutral", () => {
    const clear = analyzeBuffer(paint(200, 200, [0, 0, 0, 0]), meta(200, 200));
    expect(clear.palette.swatches).toHaveLength(0);
    const obs = observeImage(clear);
    expect(byId(obs, "largest-colour")!.title).toBe("No opaque pixels to measure");
    expect(byId(obs, "strong-colour")).toBeUndefined();
    expect(byId(obs, "contrast")).toBeUndefined();
    expect(byId(obs, "transparency")!.detail).toContain("100.0%");
    const md = observationsToMarkdown(obs).join("\n");
    expect(md).not.toMatch(/neutral|muted/i);
  });

  it("mentions transparency only above 1%, and exports every observation to Markdown", () => {
    const clear = analyzeBuffer(paint(200, 200, paper, [{ x0: 0, y0: 0, x1: 0.5, y1: 1, c: [0, 0, 0, 0] }]), meta(200, 200));
    const obs = observeImage(clear);
    expect(byId(obs, "transparency")!.detail).toMatch(/transparent/);
    const md = observationsToMarkdown(obs).join("\n");
    for (const o of obs) expect(md).toContain(`### ${o.title}`);
    expect(md).toContain("(estimated)");
  });
});
