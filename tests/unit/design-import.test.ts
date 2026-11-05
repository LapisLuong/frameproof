import { describe, expect, it } from "vitest";
import { planImport, remapDoc } from "@/lib/design/import-plan";
import { OWN_LICENCE } from "@/lib/design/library";
import type { ResourceMeta } from "@/lib/design/resource";
import { DesignDocSchema, referencedResources } from "@/lib/design/schema";

const doc = DesignDocSchema.parse({
  schema: "frameproof.design", version: 1, id: "design_a", name: "Bundle B", width: 1000, height: 1000, background: "#101d54", createdAt: 1, updatedAt: 1, projectId: "proj_x",
  layers: [
    { id: "bg", name: "Background", type: "image", resourceId: "res_da-hanh-khuc-background", x: 0, y: 0, w: 1000, h: 1000 },
    { id: "art", name: "Art", type: "image", resourceId: "res_met-39799", x: 0, y: 0, w: 100, h: 100 },
    { id: "t", name: "Title", type: "text", text: "Dạ hành khúc", font: "res_myfont", size: 80, color: "#ffffff", x: 0, y: 0, w: 900, h: 200 },
  ],
});
const meta = (id: string, kind: "image" | "font"): ResourceMeta => ({ id, kind, name: id, mime: kind === "image" ? "image/png" : "font/ttf", bytes: 3, licence: OWN_LICENCE, tags: [], createdAt: 0, updatedAt: 0 });
const incoming = [
  { meta: meta("res_da-hanh-khuc-background", "image"), bytes: new Uint8Array([1, 2, 3]) },
  { meta: meta("res_myfont", "font"), bytes: new Uint8Array([4, 5, 6]) },
];

describe("design file import", () => {
  it("gives every incoming resource a fresh id and rewrites the document's references", async () => {
    let n = 0;
    const plan = await planImport(doc, incoming, { freshId: () => `res_new${++n}`, docId: "design_new", now: 5, existingSame: async () => null });
    expect(plan.store.map((r) => r.meta.id)).toEqual(["res_new1", "res_new2"]);
    expect(referencedResources(plan.doc).sort()).toEqual(["res_met-39799", "res_new1", "res_new2"]);
    expect(plan.doc.id).toBe("design_new");
    expect(plan.doc.projectId).toBeNull();
    // Nothing in the plan carries the colliding id, so the existing resource can't be overwritten.
    expect([...plan.store.map((r) => r.meta.id), ...referencedResources(plan.doc)]).not.toContain("res_da-hanh-khuc-background");
  });

  it("reuses a resource the library already holds byte for byte, and keeps built-in art ids", async () => {
    const plan = await planImport(doc, incoming, { freshId: () => "res_fresh", docId: "design_new", now: 5, existingSame: async (r) => (r.meta.kind === "font" ? "res_existing-font" : null) });
    expect(plan.reused).toBe(1);
    expect(plan.store.map((r) => r.meta.id)).toEqual(["res_fresh"]);
    expect(plan.doc.layers.find((l) => l.id === "t")).toMatchObject({ font: "res_existing-font" });
    expect(plan.doc.layers.find((l) => l.id === "art")).toMatchObject({ resourceId: "res_met-39799" });
  });

  it("leaves references it has no mapping for unchanged", () => {
    expect(remapDoc(doc, new Map())).toEqual(doc);
  });
});
