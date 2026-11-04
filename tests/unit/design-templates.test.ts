import { composeConcepts } from "@/lib/design/compose";
import { ORNAMENTS } from "@/lib/design/items/ornaments";
import { OWN_LICENCE } from "@/lib/design/library";
import { expect, it } from "vitest";
import { TEMPLATES, getTemplate } from "@/lib/design/templates";
import { ITEMS, getItem } from "@/lib/design/items";
import { TemplateSchema, ItemSchema, docFromTemplate, placeItem } from "@/lib/design/library";
import { blankDoc, BUILTIN_FONTS, DesignDocSchema, isBuiltinFont } from "@/lib/design/schema";
import { approxMeasure, layoutText } from "@/lib/design/layout";
import { renderSvg, escapeXml } from "@/lib/design/render";

it("parses the pack with unique ids, licences and lookups", () => {
  expect(TEMPLATES).toHaveLength(11);
  expect(ITEMS.length).toBeGreaterThanOrEqual(14);
  const ids = [...TEMPLATES, ...ITEMS].map((p) => p.id);
  expect(new Set(ids).size).toBe(ids.length);
  TEMPLATES.forEach((t) => { expect(TemplateSchema.safeParse(t).success).toBe(true); expect(getTemplate(t.id)).toBe(t); });
  ITEMS.forEach((i) => { expect(ItemSchema.safeParse(i).success).toBe(true); expect(getItem(i.id)).toBe(i); });
  [...TEMPLATES, ...ITEMS].forEach((p) => expect(p.licence.id).toBe("MIT"));
  expect(getItem("missing")).toBeUndefined(); expect(getTemplate("missing")).toBeUndefined();
});
it("uses supported built-in faces, empty slots and bounded layers", () => {
  const families = new Set<string>();
  for (const p of [...TEMPLATES, ...ITEMS]) for (const l of p.layers) {
    if (l.type === "text") {
      expect(isBuiltinFont(l.font)).toBe(true);
      if (isBuiltinFont(l.font)) { const f = BUILTIN_FONTS[l.font]; expect(f.weights as readonly number[]).toContain(l.weight); if (l.italic) expect(f.italic).toBe(true); families.add(l.font); }
    }
    if (l.type === "image") expect(l.resourceId).toBeNull();
    if (!l.name.includes("(cropped)")) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.x + l.w).toBeLessThanOrEqual(p.width); expect(l.y + l.h).toBeLessThanOrEqual(p.height); }
  }
  expect(["anton", "archivo", "fraunces", "playfair-display"].filter((f) => families.has(f)).length).toBeGreaterThanOrEqual(3);
});
it("renders valid Vietnamese documents with distinct colour signatures", () => {
  const pairs = TEMPLATES.map((t) => {
    expect(t.layers.some((l) => l.type === "text" && /[ạảãàáâậầấẩẫăắằặẳẵđêềếểễệôồốổỗộơờớởỡợưừứửữựỳýỷỹỵ]/i.test(l.text))).toBe(true);
    const doc = docFromTemplate(t, "doc", 1);
    expect(DesignDocSchema.safeParse(doc).success).toBe(true);
    const svg = renderSvg(doc, { measure: approxMeasure });
    for (const l of doc.layers) if (l.type === "text" && !l.hidden) expect(svg).toContain(escapeXml(l.text.split(/\s/)[0]!));
    const first = t.layers[0]!; return t.background + (first.type === "text" ? first.color : first.type === "shape" ? first.fill : "slot");
  });
  expect(new Set(pairs).size).toBe(TEMPLATES.length);
});
it("places every item with fresh ids inside a portrait document", () => {
  const doc = blankDoc("doc", "Test", 1080, 1350, 1); let serial = 0;
  for (const item of ITEMS) doc.layers.push(...placeItem(item, doc, () => `layer_${serial++}`));
  expect(new Set(doc.layers.map((l) => l.id)).size).toBe(doc.layers.length);
  for (const l of doc.layers) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.y).toBeGreaterThanOrEqual(0); expect(l.x + l.w).toBeLessThanOrEqual(doc.width); expect(l.y + l.h).toBeLessThanOrEqual(doc.height); }
});

it("annotates every layer and gives each template one title, information and photo roles", () => {
  for (const pack of [...TEMPLATES, ...ITEMS]) for (const layer of pack.layers) {
    expect(layer.role).toBeDefined();
    if (layer.type === "image") expect(["photo", "motif"]).toContain(layer.role);
  }
  for (const template of TEMPLATES) {
    expect(template.layers.filter((l) => l.role === "title")).toHaveLength(1);
    expect(template.layers.some((l) => l.role === "info")).toBe(true);
  }
  for (const family of ["music", "collage"]) expect(TEMPLATES.filter((t) => t.concept === family).length).toBeGreaterThanOrEqual(2);
});


it.each(["tpl_lyrical-night", "tpl_new-chapter", "tpl_spotlight"])("composes a fitted Vietnamese title in %s", (id) => {
  const template = getTemplate(id)!;
  expect(TemplateSchema.safeParse(template).success).toBe(true);
  expect(template.layers.some((l) => l.type === "effect")).toBe(true);
  const title = template.layers.find((l) => l.type === "text" && l.role === "title")!;
  if (title.type !== "text") throw new Error("Missing title");
  const concepts = composeConcepts({
    templates: [template], pictures: [], measure: approxMeasure,
    brief: { title: "Dạ hành khúc", subtitle: "Coming soon", lines: ["Đêm 14 · 12 · 2026", "Nhà hát Lớn Hà Nội"], intent: "" },
    direction: { palette: [{ hex: template.background, role: "ground", origin: "manual" }, { hex: title.color, role: "ink", origin: "manual" }], fonts: { display: title.font, text: "archivo", origin: "manual" }, concepts: [template.concept], conceptsOrigin: "manual", notes: "" },
  }, 1);
  const composed = concepts[0]!.doc.layers.find((l) => l.role === "title")!;
  if (composed.type !== "text") throw new Error("Missing composed title");
  expect(composed.text).toBe("Dạ hành khúc");
  const layout = layoutText(composed, approxMeasure);
  expect(layout.overflows).toBe(false);
  expect(layout.lines.every((line) => line.width <= composed.w)).toBe(true);
});

it("parses and renders original ornaments with compact filled paths and retained tags", () => {
  expect(ORNAMENTS).toHaveLength(10);
  expect(ORNAMENTS.filter((i) => i.layers.some((l) => l.type === "shape" && l.shape === "path"))).toHaveLength(8);
  for (const item of ORNAMENTS) {
    expect(ItemSchema.safeParse(item).success).toBe(true);
    expect(item.tags.length).toBeGreaterThan(0);
    expect(getItem(item.id)).toHaveProperty("tags", item.tags);
    expect(item.licence).toEqual(OWN_LICENCE);
    const doc = blankDoc("ornament", item.name, 1080, 1350, 0);
    doc.layers = item.layers;
    const svg = renderSvg(doc, { measure: approxMeasure });
    expect(svg).toContain("data-layer=");
    for (const layer of item.layers) {
      expect(layer.role).toBe("motif");
      if (layer.type === "shape" && layer.shape === "path") {
        expect(new TextEncoder().encode(layer.path!).length).toBeLessThan(4096);
        expect(svg).toContain(layer.path!);
        expect(layer.fill).not.toBeNull();
      }
    }
  }
});
