import { describe, expect, it } from "vitest";
import { brushInImage, paintToMask, strokePoints } from "@/lib/design/mask";

describe("inpainting masks", () => {
  it("turns any painted pixel white and the rest opaque black", () => {
    const painted = new Uint8ClampedArray([198, 90, 66, 255, 0, 0, 0, 0, 10, 10, 10, 1, 255, 255, 255, 0]);
    const { mask, count } = paintToMask(painted);
    expect(count).toBe(2);
    expect([...mask]).toEqual([255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
    expect(painted[0]).toBe(198); // the painted layer itself is left alone
  });

  it("sizes the brush in picture pixels from the size chosen on screen", () => {
    expect(brushInImage(40, 500, 2000)).toBe(160);
    expect(brushInImage(40, 0, 2000)).toBe(40);
    expect(brushInImage(0.1, 1000, 10)).toBe(1);
  });

  it("spaces dabs along a stroke so they overlap", () => {
    const pts = strokePoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 40);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts.at(-1)).toEqual({ x: 100, y: 0 });
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.x - pts[i - 1]!.x).toBeLessThanOrEqual(10);
    expect(strokePoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toHaveLength(2);
  });
});

describe("typed rectangles", () => {
  it("keeps the rectangle inside the picture, in whole pixels", async () => {
    const { clampRect, defaultRect } = await import("@/lib/design/mask");
    expect(clampRect({ x: -20, y: 10.6, w: 5000, h: 0 }, 2000, 1367)).toEqual({ x: 0, y: 11, w: 2000, h: 1 });
    expect(clampRect({ x: 1999.9, y: 2000, w: 10, h: 10 }, 2000, 1367)).toEqual({ x: 1999, y: 1366, w: 1, h: 1 });
    expect(clampRect({ x: NaN, y: 5, w: Infinity, h: 3 }, 100, 100)).toEqual({ x: 0, y: 5, w: 1, h: 3 });
    expect(defaultRect(2000, 1000)).toEqual({ x: 800, y: 400, w: 400, h: 200 });
  });
});
