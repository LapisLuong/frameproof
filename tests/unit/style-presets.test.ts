import { expect, it } from "vitest";
import { STYLE_PRESETS, styleFromPreset } from "../../src/lib/styles/presets";
import { BUILTIN_FONTS } from "../../src/lib/design/fonts";

it("offers eight distinct original styles with real included font families", () => {
  expect(STYLE_PRESETS).toHaveLength(8);
  expect(new Set(STYLE_PRESETS.map((p) => p.id)).size).toBe(8);
  for (const preset of STYLE_PRESETS) {
    expect(BUILTIN_FONTS[preset.display]).toBeDefined();
    expect(BUILTIN_FONTS[preset.body]).toBeDefined();
    expect(preset.colours.every((hex) => /^#[a-f0-9]{6}$/.test(hex))).toBe(true);
    const style = styleFromPreset(preset, "sty_test", 1);
    expect(style.palette.every((c) => c.origin === "manual")).toBe(true);
    expect(style.sourceAssetId).toBeNull();
    expect(style.referenceIds).toEqual([]);
    expect(style.layoutPrinciples.length).toBeGreaterThan(1);
    expect(style.notes).toContain(preset.source);
  }
});
