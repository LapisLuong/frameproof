import { describe, expect, it } from "vitest";
import { approxMeasure, layoutText } from "@/lib/design/layout";
import { renderSvg } from "@/lib/design/render";
import { blankDoc, DesignDocSchema, referencedResources, type DesignDocInput } from "@/lib/design/schema";
import { nearestWeight } from "@/lib/design/fonts";

const base = (layers: DesignDocInput["layers"]): DesignDocInput => ({
  schema: "frameproof.design",
  version: 1,
  id: "doc_1",
  name: "Test poster",
  width: 1200,
  height: 1800,
  background: "#F6F4EF",
  layers,
  createdAt: 1,
  updatedAt: 1,
});

const text = {
  id: "t1",
  name: "Title",
  type: "text" as const,
  x: 100,
  y: 100,
  w: 400,
  h: 300,
  text: "Triển lãm mùa thu",
  font: "lora" as const,
  size: 40,
  color: "#202323",
};

describe("design schema", () => {
  it("fills defaults and normalises colours", () => {
    const doc = DesignDocSchema.parse(base([text]));
    expect(doc.background).toBe("#f6f4ef");
    expect(doc.layers[0]).toMatchObject({ rotation: 0, opacity: 1, hidden: false, locked: false, weight: 400, align: "left" });
    expect(doc.templateId).toBeNull();
  });

  it("rejects duplicate layer ids, unknown fonts, bad colours and other versions", () => {
    expect(DesignDocSchema.safeParse(base([text, text])).success).toBe(false);
    expect(DesignDocSchema.safeParse(base([{ ...text, font: "comic-sans" as never }])).success).toBe(false);
    expect(DesignDocSchema.safeParse(base([{ ...text, color: "red" }])).success).toBe(false);
    expect(DesignDocSchema.safeParse({ ...base([]), version: 2 }).success).toBe(false);
    expect(DesignDocSchema.safeParse({ ...base([]), width: 10 }).success).toBe(false);
  });

  it("lists the resources a document needs: images and user fonts, not built-in fonts or empty slots", () => {
    const doc = DesignDocSchema.parse(
      base([
        text,
        { ...text, id: "t2", font: "res_font1" },
        { id: "i1", name: "Photo", type: "image", x: 0, y: 0, w: 10, h: 10, resourceId: "res_img1" },
        { id: "i2", name: "Slot", type: "image", x: 0, y: 0, w: 10, h: 10, resourceId: null },
      ]),
    );
    expect(referencedResources(doc).sort()).toEqual(["res_font1", "res_img1"]);
  });

  it("makes a valid blank document", () => {
    expect(DesignDocSchema.safeParse(blankDoc("d", "Untitled", 1080, 1350)).success).toBe(true);
  });

  it("snaps to a weight the family ships", () => {
    expect(nearestWeight("be-vietnam-pro", 700)).toBe(600);
    expect(nearestWeight("ibm-plex-mono", 300)).toBe(400);
  });
});

describe("text layout", () => {
  const layer = { ...DesignDocSchema.parse(base([text])).layers[0] } as Extract<ReturnType<typeof DesignDocSchema.parse>["layers"][number], { type: "text" }>;

  it("wraps words to the box width and keeps explicit line breaks", () => {
    // 40 px × 0.55 = 22 px per character; 400 px fits 18 characters.
    const out = layoutText({ ...layer, text: "Triển lãm mùa thu tại Hà Nội\nTháng mười" }, approxMeasure);
    expect(out.lines.map((l) => l.text)).toEqual(["Triển lãm mùa thu", "tại Hà Nội", "Tháng mười"]);
    expect(out.lines.every((l) => l.width <= 400)).toBe(true);
  });

  it("splits a word wider than the box instead of running off it", () => {
    const out = layoutText({ ...layer, w: 100, text: "Supercalifragilistic" }, approxMeasure);
    expect(out.lines.length).toBeGreaterThan(1);
    expect(out.lines.every((l) => l.width <= 100)).toBe(true);
    expect(out.lines.map((l) => l.text).join("")).toBe("Supercalifragilistic");
  });

  it("says when text is taller than its box and never clips it", () => {
    const out = layoutText({ ...layer, h: 50, text: "a\nb\nc" }, approxMeasure);
    expect(out.lines).toHaveLength(3);
    expect(out.overflows).toBe(true);
  });

  it("places the block by vertical alignment", () => {
    const top = layoutText({ ...layer, text: "a" }, approxMeasure);
    const bottom = layoutText({ ...layer, text: "a", valign: "bottom" }, approxMeasure);
    expect(bottom.firstBaseline - top.firstBaseline).toBeCloseTo(300 - 48, 5);
  });
});

describe("SVG renderer", () => {
  const doc = DesignDocSchema.parse(
    base([
      { id: "s1", name: "Block", type: "shape", shape: "rect", x: 0, y: 0, w: 1200, h: 600, fill: "#C65A42" },
      { ...text, text: "A & B <Tết>" },
      { id: "i1", name: "Slot", type: "image", x: 0, y: 900, w: 600, h: 600, resourceId: null },
      { id: "i2", name: "Photo", type: "image", x: 600, y: 900, w: 600, h: 600, resourceId: "res_a", radius: 20 },
      { id: "h1", name: "Hidden", type: "shape", shape: "ellipse", x: 0, y: 0, w: 10, h: 10, fill: "#000000", hidden: true },
    ]),
  );

  it("draws layers bottom to top, escapes text and skips hidden layers", () => {
    const svg = renderSvg(doc, { measure: approxMeasure, image: () => "blob:x" });
    expect(svg.indexOf('data-layer="s1"')).toBeLessThan(svg.indexOf('data-layer="t1"'));
    expect(svg).toContain("A &amp; B &lt;Tết&gt;");
    expect(svg).not.toContain('data-layer="h1"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  });

  it("shows empty and missing images only as editor placeholders, never in an export", () => {
    const editor = renderSvg(doc, { measure: approxMeasure, image: () => null, placeholders: true });
    expect(editor).toContain("Add an image");
    expect(editor).toContain("Image missing");
    const exported = renderSvg(doc, { measure: approxMeasure, image: () => null });
    expect(exported).not.toContain("data-placeholder");
    expect(exported).not.toContain('data-layer="i1"');
  });

  it("is deterministic", () => {
    const o = { measure: approxMeasure, image: () => "data:image/png;base64,AA" };
    expect(renderSvg(doc, o)).toBe(renderSvg(doc, o));
  });
});
