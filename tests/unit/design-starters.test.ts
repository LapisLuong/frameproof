import { describe, expect, it } from "vitest";
import { isBuiltinArt } from "@/lib/design/art";
import { STARTERS, starterDoc } from "@/lib/design/starters";
import { DesignDocSchema } from "@/lib/design/schema";

describe("finished starters", () => {
  it("are complete: every picture slot is filled with built-in public-domain art", () => {
    expect(STARTERS.length).toBeGreaterThanOrEqual(6);
    for (const s of STARTERS) {
      const doc = DesignDocSchema.parse(starterDoc(s, `d-${s.id}`, 0));
      for (const l of doc.layers) if (l.type === "image" && l.role !== "motif") expect(l.resourceId && isBuiltinArt(l.resourceId), `${s.id} ${l.name}`).toBeTruthy();
    }
  });

  it("include some with museum art, not only type", () => {
    expect(STARTERS.filter((s) => s.art.length > 0).length).toBeGreaterThanOrEqual(3);
  });
});
