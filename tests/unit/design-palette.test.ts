import { expect, it } from "vitest";
import { adjustPalette, adjustSwatch, applyColourMap, docColours, hexToHsl, hslToHex, inferColourRoles, mapToDirection } from "@/lib/design/palette";
import { docFromTemplate } from "@/lib/design/library";
import { TEMPLATES } from "@/lib/design/templates";
import { blankDoc, LayerSchema } from "@/lib/design/schema";
import { hexToRgb } from "@/lib/color/convert";
import { contrastRatio } from "@/lib/color/contrast";

it("round trips the RGB cube samples within one 8-bit unit", () => {
  for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
    const hex = `#${[r,g,b].map((n) => n.toString(16).padStart(2,"0")).join("")}`;
    const actual = hexToRgb(hslToHex(hexToHsl(hex)))!;
    expect(Math.max(Math.abs(actual.r-r), Math.abs(actual.g-g), Math.abs(actual.b-b))).toBeLessThanOrEqual(1);
  }
});
it("wraps hue and clamps saturation and lightness deltas", () => {
  expect(adjustSwatch("#ff0000", { h: 480 })).toBe("#00ff00");
  expect(adjustSwatch("#ff0000", { s: -100 })).toBe("#808080");
  expect(adjustPalette(["#ff0000", "#000000"], { l: 100 })).toEqual(["#ffffff", "#ffffff"]);
  expect(adjustSwatch("#ffffff", { l: -100 })).toBe("#000000");
  expect(() => hslToHex({ h: NaN, s: 0, l: 0 })).toThrow();
});
const linked = () => {
  const doc = blankDoc("doc", "Test", 100, 100, 1); doc.background = "#112233";
  doc.layers = [
    LayerSchema.parse({ id: "text", name: "Text", type: "text", x: 0, y: 0, w: 50, h: 50, size: 20, font: "anton", text: "Chữ", color: "#112233" }),
    LayerSchema.parse({ id: "shape", name: "Shape", type: "shape", x: 0, y: 0, w: 50, h: 50, shape: "rect", fill: "#112233", stroke: "#112233" }),
  ]; return doc;
};
it("counts layers once per colour and includes background and usage roles", () => {
  expect(docColours(linked())).toEqual([{ hex: "#112233", uses: 3, roles: ["background", "text", "fill", "stroke"] }]);
});
it("replaces linked uses without changing unrelated document fields or mutating the input", () => {
  const doc = linked(), before = structuredClone(doc), out = applyColourMap(doc, { "#112233": "#abcdef" });
  expect(doc).toEqual(before);
  expect(out).toEqual({ ...doc, background: "#abcdef", layers: doc.layers.map((l) => l.type === "text" ? { ...l, color: "#abcdef" } : { ...l, fill: "#abcdef", stroke: "#abcdef" }) });
  expect(applyColourMap(doc, {})).toBe(doc);
  expect(applyColourMap(doc, { "#000000": "#ffffff" })).toBe(doc);
});
it("does not chain map replacements", () => {
  expect(applyColourMap(linked(), { "#112233": "#abcdef", "#abcdef": "#ffffff" }).background).toBe("#abcdef");
});
it.each(["tpl_collage", "tpl_music"])("infers deterministic roles for %s", (id) => {
  const doc = docFromTemplate(TEMPLATES.find((t) => t.id === id)!, "doc", 1);
  const roles = inferColourRoles(doc);
  expect(roles[doc.background]).toBe("ground");
  const title = doc.layers.find((l) => l.role === "title")!;
  if (title.type === "text") expect(roles[title.color]).toBe("ink");
  expect(Object.values(roles)).toContain("accent");
});
it("uses the best contrasting direction swatch when the proposed ink fails", () => {
  const doc = docFromTemplate(TEMPLATES[0]!, "doc", 1);
  const map = mapToDirection(doc, [{ hex: "#ffffff", role: "ground", origin: "manual" }, { hex: "#eeeeee", role: "ink", origin: "manual" }, { hex: "#000000", role: "accent", origin: "manual" }]);
  const ink = Object.entries(inferColourRoles(doc)).find(([, role]) => role === "ink")![0];
  expect(map[ink]).toBe("#000000");
  expect(contrastRatio(hexToRgb(map[ink]!)!, hexToRgb(map[doc.background]!)!)).toBeGreaterThanOrEqual(4.5);
});
it("cycles support swatches and falls back by Oklab lightness", () => {
  const doc = linked(); doc.background = "#ffffff";
  doc.layers[0] = LayerSchema.parse({ ...doc.layers[0], color: "#000000" });
  doc.layers[1] = LayerSchema.parse({ ...doc.layers[1], fill: "#777777", stroke: "#888888" });
  const palette = [
    { hex: "#ffffff", role: "ground" as const, origin: "manual" as const },
    { hex: "#000000", role: "ink" as const, origin: "manual" as const },
    { hex: "#666666", role: "support" as const, origin: "manual" as const },
    { hex: "#999999", role: "support" as const, origin: "manual" as const },
  ];
  const mapped = mapToDirection(doc, palette);
  expect(mapped["#777777"]).toBe("#666666"); expect(mapped["#888888"]).toBe("#999999");
  const fallback = mapToDirection(doc, palette.filter((s) => s.role !== "support"));
  expect(fallback["#888888"]).toBe("#ffffff");
  expect(mapToDirection(doc, [])).toEqual({});
});
it("breaks text area ties by hex and keeps ground priority", () => {
  const doc = linked(); doc.background = "#ffffff";
  const text = doc.layers[0]!;
  doc.layers = [LayerSchema.parse({ ...text, id: "a", color: "#222222" }), LayerSchema.parse({ ...text, id: "b", color: "#111111" })];
  expect(inferColourRoles(doc)).toEqual({ "#111111": "ink", "#222222": "support", "#ffffff": "ground" });
});
