import { describe, expect, it } from "vitest";
import { avatarFrame, CAMPAIGN_FORMATS, campaignVariants, corners, FRAME_CLEAR, isFullBleed, printDpi, recompose, safeBox, strategiesFor } from "@/lib/design/campaign";
import { renderSvg } from "@/lib/design/render";
import { approxMeasure } from "@/lib/design/layout";
import { STARTERS, starterDoc } from "@/lib/design/starters";
import { CANVAS_MAX, DesignDocSchema, STROKE_MAX, referencedResources, type Layer } from "@/lib/design/schema";

const fmt = (id: string) => CAMPAIGN_FORMATS.find((f) => f.id === id)!;
// Recomposed formats; the avatar frame is a different kind of derivative with its own tests below.
const RECOMPOSED = CAMPAIGN_FORMATS.filter((f) => !f.frame);
const inside = (l: Layer, W: number, H: number) => l.x >= -1 && l.y >= -1 && l.x + l.w <= W + 1 && l.y + l.h <= H + 1;
let n = 0;
const fresh = () => `design_c${++n}`;

describe("campaign formats", () => {
  const sources = STARTERS.map((s) => starterDoc(s, `src-${s.id}`, 0));

  it("keeps words, fonts, colours and pictures exactly, and links back to the source", () => {
    for (const doc of sources)
      for (const f of RECOMPOSED)
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
      for (const f of RECOMPOSED)
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
      for (const f of RECOMPOSED)
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
    for (const f of RECOMPOSED)
      for (const s of ["anchor", "split", "split-mirrored"] as const) {
        const r = recompose(doc, f, s, { id: "next", now: 1 }, approxMeasure);
        if (!r) continue;
        DesignDocSchema.parse(r.doc);
        const border = r.doc.layers.find((l) => l.id === "border")!;
        expect(border.type === "shape" && border.strokeWidth).toBeLessThanOrEqual(STROKE_MAX);
        if (f.width * f.height > 1080 * 1350 * 1.5) expect(r.notes.join(" ")).toContain("was capped");
      }
  });

  describe("avatar frame", () => {
    const frameFmt = fmt("avatar-frame");
    // Distance from the centre to the nearest point of a box (0 when the box covers the centre).
    const nearest = (l: Layer, c: number) => Math.hypot(Math.max(l.x - c, 0, c - (l.x + l.w)), Math.max(l.y - c, 0, c - (l.y + l.h)));

    it("is transparent with an empty centre, and the ring never reaches into it", () => {
      for (const doc of sources) {
        const { doc: frame, notes } = avatarFrame(doc, frameFmt, { id: "frame", now: 1 }, approxMeasure);
        expect(frame.transparent).toBe(true);
        expect([frame.width, frame.height, frame.sourceDesignId]).toEqual([1080, 1080, doc.id]);
        const clear = (FRAME_CLEAR * 1080) / 2;
        for (const l of frame.layers) {
          if (l.type === "shape" && l.shape === "ellipse" && l.fill === null) expect(l.w / 2 - l.strokeWidth / 2, `${doc.name} ${l.name}`).toBeGreaterThanOrEqual(clear);
          else expect(nearest(l, 540), `${doc.name} ${l.name}`).toBeGreaterThanOrEqual(clear);
        }
        expect(renderSvg(frame, { measure: approxMeasure })).not.toMatch(/<rect width="1080" height="1080"/);
        expect(notes.join(" ")).toContain("doesn't connect to any social network");
      }
    });

    it("uses the design's own title, font and colours, and names everything it leaves out", () => {
      const doc = sources[0]!;
      const { doc: frame, notes } = avatarFrame(doc, frameFmt, { id: "frame", now: 1 }, approxMeasure);
      const title = doc.layers.find((l) => l.type === "text" && l.role === "title");
      const t = frame.layers.find((l) => l.id === "frame-title");
      if (title?.type === "text" && t?.type === "text") {
        expect(t.font).toBe(title.font);
        expect(t.text).toBe(title.text.replace(/\s+/g, " ").trim());
        expect(t.color).toBe(doc.background);
      }
      const ring = frame.layers.find((l) => l.id === "frame-ring");
      expect(ring?.type === "shape" && ring.stroke).toBe(doc.background);
      const left = notes.find((n) => n.startsWith("Left out"))!;
      for (const l of doc.layers.filter((x) => !x.hidden && x.id !== title?.id)) expect(left).toContain(l.name);
      expect(notes.join(" ")).toContain("No layer is marked as the logo");
    });

    it("puts the layer marked as the logo on the frame, whole and inside the outer circle", () => {
      const base = sources[0]!;
      const doc = DesignDocSchema.parse({
        ...base,
        layers: [...base.layers, { id: "lg", name: "Club logo", type: "image", role: "logo", resourceId: "res_logo", x: 900, y: 1200, w: 120, h: 60 }],
      });
      const { doc: frame, notes } = avatarFrame(doc, frameFmt, { id: "frame", now: 1 }, approxMeasure);
      const logo = frame.layers.find((l) => l.id === "frame-logo")!;
      expect(logo.type === "image" && [logo.resourceId, logo.fit]).toEqual(["res_logo", "contain"]);
      expect(logo.w / logo.h).toBeCloseTo(2, 5);
      for (const [x, y] of corners(logo)) expect(Math.hypot(x - 540, y - 540)).toBeLessThanOrEqual(540);
      expect(notes.join(" ")).not.toContain("No layer is marked as the logo");
      expect(notes.find((n) => n.startsWith("Left out"))).not.toContain("Club logo");
    });
  });
});
