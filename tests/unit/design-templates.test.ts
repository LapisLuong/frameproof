import { expect, it } from "vitest";
import { TEMPLATES, getTemplate } from "@/lib/design/templates";
import { ITEMS, getItem } from "@/lib/design/items";
import { TemplateSchema, ItemSchema, docFromTemplate, placeItem } from "@/lib/design/library";
import { blankDoc, BUILTIN_FONTS, DesignDocSchema, isBuiltinFont } from "@/lib/design/schema";
import { approxMeasure } from "@/lib/design/layout";
import { renderSvg, escapeXml } from "@/lib/design/render";

it("parses the pack with unique ids, licences and lookups", () => {
  expect(TEMPLATES).toHaveLength(8);
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
  expect(new Set(pairs).size).toBe(8);
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
    if (layer.type === "image") expect(layer.role).toBe("photo");
  }
  for (const template of TEMPLATES) {
    expect(template.layers.filter((l) => l.role === "title")).toHaveLength(1);
    expect(template.layers.some((l) => l.role === "info")).toBe(true);
  }
  for (const family of ["music", "collage"]) expect(TEMPLATES.filter((t) => t.concept === family)).toHaveLength(2);
});
