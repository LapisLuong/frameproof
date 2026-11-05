import { describe, expect, it } from "vitest";
import { effectSvg, seeded } from "@/lib/design/effects";
import { approxMeasure } from "@/lib/design/layout";
import { renderSvg } from "@/lib/design/render";
import { starterLayer } from "@/lib/design/edit";
import { blankDoc, EFFECTS, LayerSchema, PathDataSchema, type EffectLayer } from "@/lib/design/schema";

const doc = blankDoc("design_fx", "Light test", 1080, 1350);
const fx = (effect: EffectLayer["effect"], extra: Partial<EffectLayer> = {}) =>
  LayerSchema.parse({ ...starterLayer(doc, effect, `fx-${effect}`), ...extra }) as EffectLayer;

describe("light and texture layers", () => {
  it("draws every effect as SVG with its blend mode, and nothing when hidden", () => {
    for (const e of EFFECTS) {
      const l = fx(e);
      const svg = renderSvg({ ...doc, layers: [l] }, { measure: approxMeasure });
      expect(svg, e).toContain(`data-layer="fx-${e}"`);
      if (l.blend !== "normal") expect(svg).toContain(`mix-blend-mode:${l.blend}`);
      expect(renderSvg({ ...doc, layers: [{ ...l, hidden: true }] }, { measure: approxMeasure })).not.toContain("fx-");
    }
  });

  it("is deterministic: the same seed draws the same sparkles, a new seed moves them", () => {
    const a = effectSvg(fx("sparkle", { seed: 7 }), "a", "");
    expect(effectSvg(fx("sparkle", { seed: 7 }), "a", "")).toBe(a);
    expect(effectSvg(fx("sparkle", { seed: 8 }), "a", "")).not.toBe(a);
    const r = seeded(42);
    const first = [r(), r(), r()];
    const again = seeded(42);
    expect([again(), again(), again()]).toEqual(first);
    for (const v of first) expect(v >= 0 && v < 1).toBe(true);
  });

  it("scales sparkle count with spread and keeps every star inside the box", () => {
    const few = effectSvg(fx("sparkle", { spread: 0 }), "s", "").match(/<path /g)!.length;
    const many = effectSvg(fx("sparkle", { spread: 1 }), "s", "").match(/<path /g)!.length;
    expect(few).toBe(1);
    expect(many).toBe(24);
  });

  it("uses unique ids per layer so two glows in one SVG don't share a gradient", () => {
    const svg = renderSvg({ ...doc, layers: [fx("glow", { id: "g1" }), fx("glow", { id: "g2" })] }, { measure: approxMeasure, idPrefix: "t" });
    expect(svg).toContain('id="t-fx-0-g"');
    expect(svg).toContain('id="t-fx-1-g"');
  });

  it("adds a blur filter only when blur is set", () => {
    expect(effectSvg(fx("glow", { blur: 0 }), "b", "")).not.toContain("feGaussianBlur");
    expect(effectSvg(fx("glow", { blur: 30 }), "b", "")).toContain('stdDeviation="15"');
  });
});

describe("ornament paths", () => {
  it("accepts path data and draws it scaled to the box", () => {
    const l = LayerSchema.parse({ id: "o", name: "Swash", type: "shape", shape: "path", path: "M0 500 C250 0 750 1000 1000 500", x: 100, y: 200, w: 500, h: 100, fill: null, stroke: "#f2efd1", strokeWidth: 3 });
    const svg = renderSvg({ ...doc, layers: [l] }, { measure: approxMeasure });
    expect(svg).toContain('d="M0 500 C250 0 750 1000 1000 500"');
    expect(svg).toContain("translate(100 200) scale(0.5 0.1)");
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
  });

  it("rejects anything that isn't path commands and numbers", () => {
    for (const bad of ['M0 0"/><script>alert(1)</script>', "M0 0 url(#x)", "M0 0 <", "javascript:1"]) expect(PathDataSchema.safeParse(bad).success, bad).toBe(false);
    expect(PathDataSchema.safeParse("M10,20 L30 40 Z").success).toBe(true);
  });

  it("draws nothing for a path shape without data", () => {
    const l = LayerSchema.parse({ id: "o", name: "Empty", type: "shape", shape: "path", x: 0, y: 0, w: 10, h: 10, fill: "#000000" });
    expect(renderSvg({ ...doc, layers: [l] }, { measure: approxMeasure })).not.toContain('data-layer="o"');
  });
});
