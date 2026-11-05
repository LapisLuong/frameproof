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

const effectLayer = (id: string, effect: "glow" | "beam" | "trail" | "sparkle" | "grain" | "vignette", color: string) => LayerSchema.parse({ id, name: id, type: "effect", effect, color, x: 0, y: 0, w: 100, h: 100 });
it("counts effect colour as a fill and replaces linked colours immutably in one pass", () => {
  const doc = linked(); doc.layers.push(effectLayer("glow", "glow", "#112233"));
  const before = structuredClone(doc);
  expect(docColours(doc)).toEqual([{ hex: "#112233", uses: 4, roles: ["background", "text", "fill", "stroke"] }]);
  const mapped = applyColourMap(doc, { "#112233": "#abcdef", "#abcdef": "#ffffff" });
  expect(mapped.layers[2]).toMatchObject({ color: "#abcdef" });
  expect(doc).toEqual(before);
  expect(applyColourMap(doc, {})).toBe(doc);
});
it.each(["glow", "beam", "trail", "sparkle"] as const)("gives light %s colours accent roles without stealing ink or ground", (kind) => {
  const doc = linked();
  doc.layers.push(effectLayer("light", kind, "#eee9fb"), effectLayer("shared", kind, "#112233"));
  expect(inferColourRoles(doc)["#eee9fb"]).toBe("accent");
  expect(inferColourRoles(doc)["#112233"]).toBe("ground");
  doc.background = "#000000";
  doc.layers.push(effectLayer("ink-light", kind, "#112233"));
  expect(inferColourRoles(doc)["#112233"]).toBe("ink");
});
it("keeps unique texture colours while remapping textures linked to existing roles", () => {
  const doc = linked();
  doc.layers.push(effectLayer("grain", "grain", "#abc123"), effectLayer("vignette", "vignette", "#123abc"), effectLayer("linked-grain", "grain", "#112233"));
  expect(docColours(doc).map((c) => c.hex)).toEqual(["#112233", "#123abc", "#abc123"]);
  const roles = inferColourRoles(doc);
  expect(roles["#abc123"]).toBeUndefined(); expect(roles["#123abc"]).toBeUndefined();
  const map = mapToDirection(doc, [{ hex: "#ffffff", role: "ground", origin: "manual" }]);
  const out = applyColourMap(doc, map);
  expect(out.layers.slice(2)).toMatchObject([{ color: "#abc123" }, { color: "#123abc" }, { color: "#ffffff" }]);
  // Explicit user colour edits still work for texture-only colours.
  expect(applyColourMap(doc, { "#abc123": "#eeeeee" }).layers[2]).toMatchObject({ color: "#eeeeee" });
});
it("preserves light ink precedence and treats dark neutral lights as support", () => {
  const doc = linked(); doc.background = "#000000";
  doc.layers[0] = LayerSchema.parse({ ...doc.layers[0], color: "#eee9fb" });
  doc.layers.push(effectLayer("ink", "sparkle", "#eee9fb"), effectLayer("dark", "glow", "#333333"));
  const roles = inferColourRoles(doc);
  expect(roles["#eee9fb"]).toBe("ink");
  expect(roles["#333333"]).toBe("support");
});
