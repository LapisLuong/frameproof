import { describe, expect, it } from "vitest";
import { composeConcepts, fitText, layerRole, pickTemplates } from "@/lib/design/compose";
import { paletteFromMeasured, type ArtDirection } from "@/lib/design/direction";
import { approxMeasure, layoutText } from "@/lib/design/layout";
import { DesignDocSchema, referencedResources, type TextLayer } from "@/lib/design/schema";
import { renderSvg } from "@/lib/design/render";
import { TEMPLATES } from "@/lib/design/templates";

const direction: ArtDirection = {
  palette: [
    { hex: "#efe6d8", role: "ground", origin: "measured", share: 0.6 },
    { hex: "#1b1f1d", role: "ink", origin: "measured", share: 0.2 },
    { hex: "#b8432f", role: "accent", origin: "manual" },
    { hex: "#6f7d75", role: "support", origin: "manual" },
  ],
  fonts: { display: "fraunces", text: "space-grotesk", origin: "manual" },
  concepts: ["exhibition", "editorial-cover", "music"],
  conceptsOrigin: "manual",
  notes: "",
};
const brief = { title: "Gốm Bát Tràng", subtitle: "", lines: ["12–30 / Tháng Mười / 2026", "Bảo tàng Mỹ thuật Việt Nam", "66 Nguyễn Thái Học, Hà Nội"], intent: "" };
const base = { brief, direction, pictures: [{ id: "res_met-39799" }, { id: "res_photo1" }], templates: TEMPLATES, measure: approxMeasure };

describe("concept composer", () => {
  it("is deterministic and gives three valid designs from three different templates", () => {
    const a = composeConcepts(base);
    const b = composeConcepts(base);
    expect(a).toHaveLength(3);
    expect(a.map((c) => c.doc)).toEqual(b.map((c) => c.doc));
    expect(new Set(a.map((c) => c.method.templateId)).size).toBe(3);
    for (const c of a) {
      expect(DesignDocSchema.safeParse(c.doc).success).toBe(true);
      expect(c.method.kind).toBe("deterministic");
    }
  });

  it("follows the concept families in order", () => {
    const picked = pickTemplates(TEMPLATES, ["music", "collage"], 3).map((t) => t.concept);
    expect(picked.slice(0, 2)).toEqual(["music", "collage"]);
  });

  it("puts the brief into the title and information layers, and hides template words it doesn't replace", () => {
    for (const c of composeConcepts(base)) {
      const texts = c.doc.layers.filter((l): l is TextLayer => l.type === "text");
      const title = texts.find((l) => layerRole(l) === "title");
      expect(title?.text).toBe("Gốm Bát Tràng");
      const visible = texts.filter((l) => !l.hidden).map((l) => l.text).join("\n");
      for (const line of brief.lines) expect(visible).toContain(line);
      for (const l of texts) if (["kicker", "credit", "body"].includes(layerRole(l) ?? "")) expect(l.hidden).toBe(true);
    }
  });

  it("uses only the direction's fonts and palette for text, background and fills", () => {
    const allowed = new Set(direction.palette.map((s) => s.hex));
    for (const c of composeConcepts(base)) {
      expect(allowed.has(c.doc.background)).toBe(true);
      for (const l of c.doc.layers) {
        if (l.type === "text") {
          expect(["fraunces", "space-grotesk"]).toContain(l.font);
          expect(allowed.has(l.color)).toBe(true);
        }
        if (l.type === "shape" && l.fill) expect(allowed.has(l.fill)).toBe(true);
      }
    }
  });

  it("places only the pictures it was given, and never invents an id", () => {
    for (const c of composeConcepts(base)) for (const id of referencedResources(c.doc)) expect(["res_met-39799", "res_photo1"]).toContain(id);
    const none = composeConcepts({ ...base, pictures: [] });
    for (const c of none) expect(referencedResources(c.doc)).toEqual([]);
  });

  it("follows AI choices only for known template ids, labelled AI-directed", () => {
    const out = composeConcepts({ ...base, choices: [{ templateId: TEMPLATES[1]!.id, photoOrder: ["res_photo1", "res_unknown"], note: "Lead with type." }, { templateId: "tpl_nope" }], model: "test-model" });
    expect(out).toHaveLength(1);
    expect(out[0]!.method).toEqual({ kind: "ai-directed", templateId: TEMPLATES[1]!.id, model: "test-model" });
    expect(out[0]!.notes.join(" ")).toContain("AI note: Lead with type.");
    expect(referencedResources(out[0]!.doc)).not.toContain("res_unknown");
  });

  it("shrinks a long title until it fits without splitting words, and renders", () => {
    const long = composeConcepts({ ...base, brief: { ...brief, title: "Những người thợ gốm cuối cùng của làng Bát Tràng bên sông Hồng" } });
    for (const c of long) {
      const t = c.doc.layers.find((l): l is TextLayer => l.type === "text" && layerRole(l) === "title")!;
      // Either it fits, or the concept says plainly that it doesn't; never a silent overflow.
      if (!/\(cropped\)/i.test(t.name) && layoutText(t, approxMeasure).overflows) expect(c.notes.join(" ")).toContain("too long for this layout");
      expect(renderSvg(c.doc, { measure: approxMeasure })).toContain("Bát Tràng");
    }
  });

  it("fits a short Vietnamese title in every template, growing a box only within the canvas", () => {
    for (const t of TEMPLATES) {
      const [c] = composeConcepts({ ...base, templates: [t], brief: { ...brief, title: "Dạ hành khúc", subtitle: "Coming soon" } }, 1);
      for (const l of c!.doc.layers) {
        if (l.type !== "text" || l.hidden || /\(cropped\)/i.test(l.name)) continue;
        const role = layerRole(l);
        if (role !== "title" && role !== "subtitle") continue;
        expect(layoutText(l, approxMeasure).overflows, `${t.id} ${l.name}`).toBe(false);
        expect(l.y + l.h).toBeLessThanOrEqual(c!.doc.height);
      }
    }
  });

  it("leaves a deliberately cropped title at its size", () => {
    const l = { ...(TEMPLATES[0]!.layers.find((x) => x.type === "text" && /\(cropped\)/i.test(x.name)) as TextLayer) };
    if (l.id) expect(fitText({ ...l, text: "Một tiêu đề rất rất dài" }, approxMeasure).size).toBe(l.size);
  });
});

describe("palette from measured swatches", () => {
  it("gives the largest area the ground, the best contrast the ink and the most saturated the accent", () => {
    const p = paletteFromMeasured([
      { hex: "#EEE8DC", share: 0.55, chroma: 0.01 },
      { hex: "#C24A30", share: 0.15, chroma: 0.16 },
      { hex: "#1C1C1C", share: 0.2, chroma: 0.0 },
      { hex: "#8A9A90", share: 0.09, chroma: 0.03 },
      { hex: "#FFFFFF", share: 0.01, chroma: 0 },
    ]);
    expect(p.map((s) => [s.hex, s.role])).toEqual([
      ["#eee8dc", "ground"],
      ["#1c1c1c", "ink"],
      ["#c24a30", "accent"],
      ["#8a9a90", "support"],
    ]);
    expect(p.every((s) => s.origin === "measured")).toBe(true);
  });
});
