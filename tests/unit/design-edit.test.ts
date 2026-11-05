import { describe, expect, it } from "vitest";
import { addLayer, duplicateLayer, hitTest, moveLayer, removeLayer, resizeBox, resizeRotated, starterLayer, updateLayer } from "@/lib/design/edit";
import { historyCommit, historyEnd, historyLive, historyRedo, historyUndo, type HistoryState } from "@/lib/design/history";
import { ItemSchema, placeItem } from "@/lib/design/library";
import { blankDoc, DesignDocSchema, isBuiltinFont } from "@/lib/design/schema";

const doc0 = () => blankDoc("d", "Test", 1200, 1800);
let n = 0;
const id = () => `l${++n}`;

describe("editing operations", () => {
  it("adds, updates, duplicates, reorders and removes layers immutably", () => {
    const d0 = doc0();
    const a = addLayer(d0, starterLayer(d0, "rect", "a"));
    const b = addLayer(a.doc, starterLayer(a.doc, "text", "b"));
    expect(d0.layers).toHaveLength(0);
    expect(b.doc.layers.map((l) => l.id)).toEqual(["a", "b"]);
    const moved = moveLayer(b.doc, "a", "front");
    expect(moved.layers.map((l) => l.id)).toEqual(["b", "a"]);
    expect(moveLayer(moved, "a", "forward")).toBe(moved);
    const dup = duplicateLayer(moved, "b", "c");
    expect(dup.doc.layers.map((l) => l.id)).toEqual(["b", "c", "a"]);
    expect(dup.doc.layers[1]).toMatchObject({ name: "Text copy", x: dup.doc.layers[0]!.x + 24 });
    expect(removeLayer(dup.doc, "b").layers.map((l) => l.id)).toEqual(["c", "a"]);
    expect(DesignDocSchema.safeParse(dup.doc).success).toBe(true);
  });

  it("ignores an update the schema would reject instead of corrupting the document", () => {
    const d = addLayer(doc0(), starterLayer(doc0(), "text", "t")).doc;
    expect(updateLayer(d, "t", { opacity: 3 } as never)).toBe(d);
    expect(updateLayer(d, "t", { opacity: 0.5 }).layers[0]!.opacity).toBe(0.5);
  });

  it("hit-tests the topmost visible, unlocked layer, allowing for rotation", () => {
    let d = addLayer(doc0(), { id: "bottom", name: "B", type: "shape", shape: "rect", x: 0, y: 0, w: 1200, h: 1800, fill: "#000000" }).doc;
    d = addLayer(d, { id: "bar", name: "Bar", type: "shape", shape: "rect", x: 500, y: 800, w: 200, h: 20, fill: "#ffffff", rotation: 90 }).doc;
    // Rotated 90° around (600, 810): it now covers x 590..610, y 710..910.
    expect(hitTest(d, 600, 720)?.id).toBe("bar");
    expect(hitTest(d, 520, 810)?.id).toBe("bottom");
    d = updateLayer(d, "bottom", { locked: true });
    expect(hitTest(d, 10, 10)).toBeNull();
    expect(hitTest(d, 10, 10, { includeLocked: true })?.id).toBe("bottom");
  });

  it("resizes from a handle, keeping the opposite edge and the ratio when asked", () => {
    expect(resizeBox({ x: 100, y: 100, w: 200, h: 100 }, "nw", 50, 20)).toEqual({ x: 150, y: 120, w: 150, h: 80 });
    expect(resizeBox({ x: 0, y: 0, w: 200, h: 100 }, "se", 200, 0, true)).toEqual({ x: 0, y: 0, w: 400, h: 200 });
    expect(resizeBox({ x: 0, y: 0, w: 10, h: 10 }, "e", -50, 0).w).toBe(1);
  });
});

describe("resizing rotated layers", () => {
  const world = (b: { x: number; y: number; w: number; h: number }, rot: number, lx: number, ly: number) => {
    const t = (rot * Math.PI) / 180;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    return { x: cx + lx * Math.cos(t) - ly * Math.sin(t), y: cy + lx * Math.sin(t) + ly * Math.cos(t) };
  };

  it("keeps the opposite edge midpoint in place (review repro: 100,100 100×100 at 90°, east handle +50)", () => {
    const next = resizeRotated({ x: 100, y: 100, w: 100, h: 100, rotation: 90 }, "e", 50, 0);
    expect(next.w).toBe(150);
    const west = world(next, 90, -next.w / 2, 0);
    expect(west.x).toBeCloseTo(150, 6);
    expect(west.y).toBeCloseTo(100, 6);
  });

  it("keeps the opposite corner for any angle and handle", () => {
    const box = { x: 40, y: 60, w: 200, h: 120, rotation: 33 };
    for (const [handle, sx, sy] of [["se", -1, -1], ["nw", 1, 1], ["ne", -1, 1], ["sw", 1, -1], ["n", 0, 1], ["s", 0, -1]] as const) {
      const before = world(box, 33, (sx * box.w) / 2, (sy * box.h) / 2);
      const next = resizeRotated(box, handle, 37, -21);
      const after = world(next, 33, (sx * next.w) / 2, (sy * next.h) / 2);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
    }
  });

  it("matches the plain resize when there is no rotation", () => {
    expect(resizeRotated({ x: 100, y: 100, w: 200, h: 100, rotation: 0 }, "nw", 50, 20)).toEqual(resizeBox({ x: 100, y: 100, w: 200, h: 100 }, "nw", 50, 20));
  });
});

describe("placing items", () => {
  it("caps the scale so a large text item stays within the schema (review repro: 200×200, size 500 into 1200×1800)", () => {
    const item = ItemSchema.parse({
      id: "item_big",
      name: "Big",
      kind: "type",
      width: 200,
      height: 200,
      layers: [{ id: "t", name: "T", type: "text", x: 0, y: 0, w: 200, h: 200, text: "Á", font: "anton", size: 500, color: "#000000" }],
      licence: { id: "MIT", author: "x", source: "FrameProof" },
    });
    const layers = placeItem(item, doc0(), id);
    const t = layers[0]!;
    expect(t.type === "text" && t.size).toBe(1000);
    expect(t.w).toBeCloseTo(400, 5);
  });
});

describe("undo history", () => {
  const start = (v: number): HistoryState<number> => ({ past: [], present: v, future: [], gestureBase: null, lastKey: null });

  it("records commits, merges keyed edits within a second, undoes and redoes", () => {
    let s = historyCommit(start(0), 1, undefined, 0);
    s = historyCommit(s, 2, "size", 100);
    s = historyCommit(s, 3, "size", 600);
    expect(s.past).toEqual([0, 1]);
    s = historyCommit(s, 4, "size", 2000);
    expect(s.past).toEqual([0, 1, 3]);
    s = historyUndo(s);
    expect(s.present).toBe(3);
    s = historyRedo(s);
    expect(s.present).toBe(4);
  });

  it("is pure: the same transition twice gives equal results (Strict Mode safety)", () => {
    const base = historyCommit(start(0), 1, "k", 0);
    expect(historyCommit(base, 2, "k", 10)).toEqual(historyCommit(base, 2, "k", 10));
    expect(historyCommit(base, 2, "k", 10).past).toEqual([0]);
  });

  it("records a drag as one step, and undo mid-gesture closes it first", () => {
    let s = historyLive(start(0), 1);
    s = historyLive(s, 2);
    s = historyLive(s, 3);
    expect(s.past).toEqual([]);
    s = historyEnd(s);
    expect(s.past).toEqual([0]);
    expect(s.present).toBe(3);
    const mid = historyUndo(historyLive(s, 9));
    expect(mid.present).toBe(3);
  });
});

it("doesn't treat prototype names as fonts", () => {
  expect(isBuiltinFont("toString" as never)).toBe(false);
  expect(isBuiltinFont("anton")).toBe(true);
});
