import { describe, expect, it } from "vitest";
import { applyPaletteEdit, docSwatches, startSession, toggleLock } from "@/lib/design/doc-palette";
import { adjustPalette } from "@/lib/design/palette";
import { DesignDocSchema } from "@/lib/design/schema";

const doc = DesignDocSchema.parse({
  schema: "frameproof.design", version: 1, id: "d1", name: "Palette", width: 1000, height: 1000, background: "#101d54", createdAt: 0, updatedAt: 0,
  layers: [
    { id: "t1", name: "Title", type: "text", text: "Dạ hành khúc", font: "cormorant-garamond", size: 120, color: "#eee9fb", x: 0, y: 0, w: 900, h: 200 },
    { id: "t2", name: "Info", type: "text", text: "Đêm 14", font: "be-vietnam-pro", size: 30, color: "#eee9fb", x: 0, y: 800, w: 900, h: 60 },
    { id: "s1", name: "Disc", type: "shape", shape: "ellipse", fill: "#a2b9e2", x: 100, y: 300, w: 300, h: 300 },
    { id: "logo", name: "Club mark", type: "shape", shape: "rect", fill: "#c8102e", x: 900, y: 900, w: 60, h: 60 },
  ],
});

describe("design palette", () => {
  it("lists each colour once with where it's used", () => {
    const s = docSwatches(doc);
    expect(s.map((x) => x.hex)).toEqual(["#101d54", "#eee9fb", "#a2b9e2", "#c8102e"]); // background, then by use
    expect(s[0]!.label).toBe("Background");
    expect(s[1]!.label).toBe("Text ×2");
  });

  it("changes a colour everywhere it's used, from the gesture's starting point", () => {
    const session = startSession(doc);
    const step1 = applyPaletteEdit(session, ["#101d54", "#ffd27a", "#a2b9e2", "#c8102e"]);
    expect(step1.layers.filter((l) => l.type === "text").map((l) => (l.type === "text" ? l.color : ""))).toEqual(["#ffd27a", "#ffd27a"]);
    // Dragging back to the start restores the original document exactly.
    expect(applyPaletteEdit(session, session.hexes)).toBe(doc);
  });

  it("doesn't merge two colours that pass through each other mid-drag", () => {
    const session = startSession(doc);
    // Swap the text and disc colours in one step: each still maps from its own original.
    const swapped = applyPaletteEdit(session, ["#101d54", "#a2b9e2", "#eee9fb", "#c8102e"]);
    const disc = swapped.layers.find((l) => l.id === "s1")!;
    expect(disc.type === "shape" && disc.fill).toBe("#eee9fb");
    const title = swapped.layers.find((l) => l.id === "t1")!;
    expect(title.type === "text" && title.color).toBe("#a2b9e2");
  });

  it("keeps locked brand colours through whole-palette changes", () => {
    const locked = toggleLock(doc, "#C8102E");
    expect(docSwatches(locked).find((s) => s.hex === "#c8102e")!.locked).toBe(true);
    const session = startSession(locked);
    const darker = applyPaletteEdit(session, adjustPalette(session.hexes, { l: -20 }));
    const logo = darker.layers.find((l) => l.id === "logo")!;
    expect(logo.type === "shape" && logo.fill).toBe("#c8102e");
    expect(darker.background).not.toBe("#101d54");
    expect(toggleLock(locked, "#c8102e").lockedColours).toEqual([]);
  });
});
