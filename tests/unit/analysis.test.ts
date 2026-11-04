import { describe, expect, it } from "vitest";
import { contrastRatio, formatRatio, gradeContrast } from "@/lib/color/contrast";
import { deltaEOK, hexToRgb, oklabToRgb, rgbToHex, rgbToOklab } from "@/lib/color/convert";
import { analyzeBuffer, describeAspect, compareBuffers, stripDiff } from "@/lib/analysis/analyze";
import { extractPalette, colorFrequency } from "@/lib/analysis/palette";
import { createBuffer, fillRect, fitContain, resample } from "@/lib/analysis/pixels";
import { measureStructure } from "@/lib/analysis/structure";
import { dHash, hamming64 } from "@/lib/analysis/similarity";

describe("colour conversion", () => {
  it("round-trips sRGB through Oklab", () => {
    for (const hex of ["#F6F4EF", "#C65A42", "#202323", "#779084", "#000000", "#FFFFFF"]) {
      expect(rgbToHex(oklabToRgb(rgbToOklab(hexToRgb(hex)!)))).toBe(hex);
    }
  });
  it("puts white at L≈1 and black at L≈0", () => {
    expect(rgbToOklab({ r: 255, g: 255, b: 255 }).L).toBeCloseTo(1, 3);
    expect(rgbToOklab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 6);
  });
  it("parses short hex and rejects junk", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("nope")).toBeNull();
  });
});

describe("WCAG contrast", () => {
  it("matches the published extremes", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
    expect(contrastRatio({ r: 10, g: 10, b: 10 }, { r: 10, g: 10, b: 10 })).toBe(1);
  });
  it("matches a known pair (#777 on white ≈ 4.48)", () => {
    const r = contrastRatio(hexToRgb("#777777")!, hexToRgb("#FFFFFF")!);
    expect(r).toBeCloseTo(4.48, 2);
    expect(gradeContrast(hexToRgb("#777777")!, hexToRgb("#FFFFFF")!).aaNormal).toBe(false);
  });
  it("never rounds a failing ratio up to a passing display", () => {
    expect(formatRatio(4.499)).toBe("4.49:1");
  });
});

describe("palette", () => {
  it("finds two colours in a half-and-half image with correct shares", () => {
    const b = createBuffer(100, 100, [246, 244, 239, 255]);
    fillRect(b, 0, 0, 100, 30, [198, 90, 66, 255]);
    const p = extractPalette(b, 6);
    expect(p.swatches).toHaveLength(2);
    expect(p.swatches[0]!.hex).toBe("#F6F4EF");
    expect(p.swatches[0]!.share).toBeCloseTo(0.7, 5);
    expect(p.swatches[1]!.hex).toBe("#C65A42");
  });
  it("is deterministic across runs", () => {
    const b = createBuffer(64, 64);
    for (let i = 0; i < b.data.length; i += 4) {
      b.data[i] = (i * 7) % 256;
      b.data[i + 1] = (i * 13) % 256;
      b.data[i + 2] = (i * 29) % 256;
      b.data[i + 3] = 255;
    }
    expect(extractPalette(b, 6).swatches.map((s) => s.hex)).toEqual(extractPalette(b, 6).swatches.map((s) => s.hex));
  });
  it("excludes transparent pixels and reports their share", () => {
    const b = createBuffer(10, 10, [0, 0, 0, 0]);
    fillRect(b, 0, 0, 10, 5, [255, 0, 0, 255]);
    const p = extractPalette(b);
    expect(p.transparentShare).toBeCloseTo(0.5);
    expect(p.swatches[0]!.share).toBeCloseTo(1);
  });
  it("frequency bins sum to at most 1", () => {
    const b = createBuffer(20, 20, [10, 200, 30, 255]);
    const f = colorFrequency(b);
    expect(f[0]!.share).toBe(1);
  });
});

describe("structure", () => {
  it("reports zero edges and full quiet area for a flat image", () => {
    const s = measureStructure(createBuffer(64, 64, [200, 200, 200, 255]));
    expect(s.edgeDensity).toBe(0);
    expect(s.quietShare).toBe(1);
    expect(s.lumaStdDev).toBeCloseTo(0, 6);
  });
  it("places the detail centroid near a detailed corner", () => {
    const b = createBuffer(100, 100, [255, 255, 255, 255]);
    for (let y = 0; y < 30; y += 2) fillRect(b, 0, y, 30, 1, [0, 0, 0, 255]);
    const s = measureStructure(b);
    expect(s.detailCentroid.x).toBeLessThan(0.3);
    expect(s.detailCentroid.y).toBeLessThan(0.3);
    expect(s.edgeDensity).toBeGreaterThan(0);
  });
});

describe("comparison", () => {
  it("identical images: SSIM 1, hash distance 0, nothing changed", () => {
    const a = createBuffer(80, 100, [240, 240, 240, 255]);
    fillRect(a, 10, 10, 60, 20, [30, 30, 30, 255]);
    const c = compareBuffers(a, a, { width: 80, height: 100 }, { width: 80, height: 100 });
    expect(c.ssim).toBeCloseTo(1, 6);
    expect(c.dHashDistance).toBe(0);
    expect(c.changedShare).toBe(0);
    expect(c.aspectDifference).toBe(0);
  });
  it("detects a moved block", () => {
    const a = createBuffer(80, 100, [240, 240, 240, 255]);
    fillRect(a, 10, 10, 60, 20, [30, 30, 30, 255]);
    const b = createBuffer(80, 100, [240, 240, 240, 255]);
    fillRect(b, 10, 70, 60, 20, [30, 30, 30, 255]);
    const c = compareBuffers(a, b, { width: 80, height: 100 }, { width: 80, height: 100 });
    expect(c.ssim).toBeLessThan(0.9);
    expect(c.changedShare).toBeGreaterThan(0.2);
    expect(hamming64(dHash(a), dHash(b))).toBeGreaterThan(0);
  });
  it("letterboxes instead of stretching", () => {
    const wide = createBuffer(200, 100, [255, 0, 0, 255]);
    const fitted = fitContain(wide, 100, 100);
    // top-left corner is grey letterbox, centre is red
    expect(Array.from(fitted.data.slice(0, 3))).toEqual([128, 128, 128]);
    const mid = (50 * 100 + 50) * 4;
    expect(fitted.data[mid]).toBe(255);
    expect(fitted.data[mid + 1]).toBe(0);
  });
  it("stripDiff removes the pixel map for storage", () => {
    const a = createBuffer(10, 10, [0, 0, 0, 255]);
    const s = stripDiff(compareBuffers(a, a, { width: 10, height: 10 }, { width: 10, height: 10 }));
    expect("diff" in s).toBe(false);
  });
});

describe("aspect labels", () => {
  it("reduces simple ratios and approximates paper sizes", () => {
    expect(describeAspect(1080, 1350).label).toBe("4:5");
    expect(describeAspect(1240, 1754).label).toBe("≈ ISO A portrait (1:√2)");
    expect(describeAspect(1000, 333).label).toMatch(/3\.003:1/);
  });
});

describe("analyzeBuffer", () => {
  it("downscales to 256 on the long side and keeps original dimensions", () => {
    const a = analyzeBuffer(createBuffer(1024, 512, [10, 20, 30, 255]), { width: 1024, height: 512, bytes: 1, kind: "png" });
    expect(a.analysisSize).toEqual({ width: 256, height: 128 });
    expect(a.width).toBe(1024);
    expect(a.palette.swatches[0]!.hex).toBe("#0A141E");
  });
  it("ΔE sanity: identical colours are 0 apart", () => {
    const x = rgbToOklab({ r: 1, g: 2, b: 3 });
    expect(deltaEOK(x, x)).toBe(0);
  });
});

it("weights fractional source pixel coverage", () => {
  const input = createBuffer(3, 1, [255, 255, 255, 255]);
  input.data.set([0, 0, 0, 255], 0);
  const output = resample(input, 2, 1);
  // The first destination pixel covers source [0, 1.5): black + half white.
  // (0 * 1 + 255 * 0.5) / 1.5 = 85. The second covers only white.
  expect(Array.from(output.data)).toEqual([85, 85, 85, 255, 255, 255, 255, 255]);
});

it("preserves integer-ratio area averages including alpha exactly", () => {
  const input = createBuffer(4, 2);
  input.data.set([10, 20, 30, 255, 100, 110, 120, 0, 60, 70, 80, 128, 200, 210, 220, 128, 30, 40, 50, 255, 50, 60, 70, 255, 0, 10, 20, 0, 100, 110, 120, 0]);
  expect(Array.from(resample(input, 2, 1).data)).toEqual([30, 40, 50, 191, 130, 140, 150, 64]);
});

it("weights fractional overlap in both axes and divides alpha by area", () => {
  const input = createBuffer(3, 3, [200, 100, 50, 0]);
  input.data.set([30, 60, 90, 255], 0);
  expect(Array.from(resample(input, 2, 2).data.slice(0, 4))).toEqual([30, 60, 90, 113]);
});
