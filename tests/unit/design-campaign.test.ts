import { describe, expect, it } from "vitest";
import { CAMPAIGN_FORMATS, campaignVariants, corners, isFullBleed, printDpi, recompose, safeBox, strategiesFor } from "@/lib/design/campaign";
import { approxMeasure } from "@/lib/design/layout";
import { STARTERS, starterDoc } from "@/lib/design/starters";
import { CANVAS_MAX, DesignDocSchema, STROKE_MAX, referencedResources, type Layer } from "@/lib/design/schema";

const fmt = (id: string) => CAMPAIGN_FORMATS.find((f) => f.id === id)!;
const inside = (l: Layer, W: number, H: number) => l.x >= -1 && l.y >= -1 && l.x + l.w <= W + 1 && l.y + l.h <= H + 1;
let n = 0;
const fresh = () => `design_c${++n}`;

describe("campaign formats", () => {
  const sources = STARTERS.map((s) => starterDoc(s, `src-${s.id}`, 0));

  it("keeps words, fonts, colours and pictures exactly, and links back to the source", () => {
    for (const doc of sources)
      for (const f of CAMPAIGN_FORMATS)
        for (const r of campaignVariants(doc, f, fresh, 1, approxMeasure, 3)) {
          DesignDocSchema.parse(r.doc);
          expect(r.doc.sourceDesignId).toBe(doc.id);
          expect([r.doc.width, r.doc.height]).toEqual([f.width, f.height]);
          expect(referencedResources(r.doc).sort()).toEqual(referencedResources(doc).sort());
          expect(r.doc.background).toBe(doc.background);
          for (const l of r.doc.layers) {
            const o = doc.layers.find((x) => x.id === l.id)!;
            if (l.type === "text" && o.type === "text") expect([l.text, l.font, l.color, l.weight]).toEqual([o.text, o.font, o.color, o.weight]);
            if (l.type === "shape" && o.type === "shape") expect([l.fill, l.stroke]).toEqual([o.fill, o.stroke]);
          }
        }
  });

  it("recomposes rather than stretches: each layer keeps its own proportions", () => {
    for (const doc of sources)
      for (const f of CAMPAIGN_FORMATS)
        for (const r of campaignVariants(doc, f, fresh, 1, approxMeasure, 3))
          for (const l of r.doc.layers) {
            const o = doc.layers.find((x) => x.id === l.id)!;
            if (isFullBleed(o, doc)) expect([l.x, l.y, l.w, l.h]).toEqual([0, 0, f.width, f.height]);
            // Hairlines clamp at 1 px, which is the only allowed change of proportion.
            else if (l.w > 1 && l.h > 1) expect(l.w / l.h).toBeCloseTo(o.w / o.h, 3);
          }
  });

  it("keeps non-rotated content on the canvas when the source had it there", () => {
    for (const doc of sources) {
      const onCanvas = new Set(doc.layers.filter((l) => !l.rotation && inside(l, doc.width, doc.height)).map((l) => l.id));
      for (const f of CAMPAIGN_FORMATS)
        for (const r of campaignVariants(doc, f, fresh, 1, approxMeasure, 3))
          for (const l of r.doc.layers) if (onCanvas.has(l.id)) expect(inside(l, f.width, f.height), `${doc.name} → ${f.id} (${r.strategy}) ${l.name}`).toBe(true);
    }
  });

  it("offers zone layouts first when the shape changes a lot", () => {
    expect(strategiesFor({ width: 1080, height: 1350 }, fmt("banner"))[0]).toBe("split");
    expect(strategiesFor({ width: 1080, height: 1350 }, fmt("square"))[0]).toBe("anchor");
    const doc = sources[0]!;
    const [a, b] = campaignVariants(doc, fmt("banner"), fresh, 1, approxMeasure, 2);
    expect(a!.doc.layers).not.toEqual(b!.doc.layers);
  });

  it("states print resolution for the standee instead of implying 300 DPI", () => {
    const standee = fmt("standee-80x180");
    expect(printDpi(standee)).toBe(85);
    const r = recompose(sources[0]!, standee, "anchor", { id: "design_s", now: 1 }, approxMeasure)!;
    expect(r.notes.join(" ")).toContain("about 85 DPI");
    expect(r.notes.join(" ")).toContain("SVG");
  });

  it("keeps content inside the avatar circle and clear of the story's platform bands", () => {
    const avatar = fmt("avatar");
    const story = fmt("story");
    const r = (avatar.width * avatar.circleSafe!) / 2;
    const band = safeBox(story);
    for (const doc of sources) {
      const onCanvas = new Set(doc.layers.filter((l) => !l.rotation && !isFullBleed(l, doc) && inside(l, doc.width, doc.height)).map((l) => l.id));
      for (const v of campaignVariants(doc, avatar, fresh, 1, approxMeasure, 3)) {
        for (const l of v.doc.layers)
          if (onCanvas.has(l.id)) for (const [x, y] of corners(l)) expect(Math.hypot(x - 540, y - 540), `${doc.name} ${v.strategy} ${l.name}`).toBeLessThanOrEqual(r + 1);
        // Only a layer the source itself lets run off the canvas (a deliberately cropped title) may be named.
        const crop = v.notes.find((x) => x.includes("will be cropped"));
        if (crop) for (const l of doc.layers.filter((x) => onCanvas.has(x.id))) expect(crop).not.toContain(`${l.name}:`);
      }
      for (const v of campaignVariants(doc, story, fresh, 1, approxMeasure, 3))
        for (const l of v.doc.layers) if (onCanvas.has(l.id)) expect(l.y >= band.y - 1 && l.y + l.h <= band.y + band.h + 1, `${doc.name} ${v.strategy} ${l.name}`).toBe(true);
    }
  });

  it("measures rotated layers by their drawn corners", () => {
    const l = { x: 0, y: 0, w: 100, h: 0.0001, rotation: 90 } as Layer;
    const ys = corners(l).map(([, y]) => y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 3);
  });

  it("caps sizes at the editor's limits instead of failing on a valid extreme design", () => {
    const doc = DesignDocSchema.parse({
      schema: "frameproof.design",
      version: 1,
      id: "extreme",
      name: "Stroke test",
      width: 1080,
      height: 1350,
      background: "#ffffff",
      layers: [
        { id: "border", name: "Border", type: "shape", shape: "rect", x: 100, y: 100, w: 600, h: 600, fill: "#ffffff", stroke: "#000000", strokeWidth: STROKE_MAX, radius: CANVAS_MAX },
        { id: "wide", name: "Wide band", type: "shape", shape: "rect", x: -CANVAS_MAX, y: 200, w: CANVAS_MAX * 2, h: 40, fill: "#000000" },
        { id: "photo", name: "Photo", type: "image", resourceId: "res_x", x: 100, y: 800, w: 400, h: 400, radius: CANVAS_MAX },
      ],
      createdAt: 0,
      updatedAt: 0,
    });
    for (const f of CAMPAIGN_FORMATS)
      for (const s of ["anchor", "split", "split-mirrored"] as const) {
        const r = recompose(doc, f, s, { id: "next", now: 1 }, approxMeasure);
        if (!r) continue;
        DesignDocSchema.parse(r.doc);
        const border = r.doc.layers.find((l) => l.id === "border")!;
        expect(border.type === "shape" && border.strokeWidth).toBeLessThanOrEqual(STROKE_MAX);
        if (f.width * f.height > 1080 * 1350 * 1.5) expect(r.notes.join(" ")).toContain("was capped");
      }
  });
});
