import { describe, expect, it } from "vitest";
import { recordSchemas, sortRecentProjects, textToTokens, validateRecords } from "@/lib/store/validation";
const project = { id: "p", name: "Old project", brief: "", referenceAssetId: null, currentAssetId: null, createdAt: 1, updatedAt: 2 };
describe("stored records", () => {
  it("loads legacy projects without an opened timestamp", () => expect(recordSchemas.projects.safeParse(project).success).toBe(true));
  it("skips corrupt records without changing the input", () => {
    const rows = [project, { ...project, brief: null }, null, { id: "broken" }];
    expect(validateRecords("projects", rows)).toEqual({ records: [project], skipped: 3 });
    expect(rows).toHaveLength(4);
  });
  it("rejects broken nested style data", () => expect(recordSchemas.styles.safeParse({ id: "s", palette: [null] }).success).toBe(false));
  it("rejects reviews with malformed issues and assets without blobs", () => {
    expect(recordSchemas.reviews.safeParse({ issues: [{ title: "bad" }] }).success).toBe(false);
    expect(recordSchemas.assets.safeParse({ blob: "bad" }).success).toBe(false);
  });
});
describe("recent projects", () => {
  it("uses opens before edit dates and preserves the input order", () => {
    const rows = [{ ...project, id: "recent edit", updatedAt: 20 }, { ...project, lastOpenedAt: 30 }];
    expect(sortRecentProjects(rows).map(p => p.id)).toEqual(["p", "recent edit"]);
    expect(rows[0]!.id).toBe("recent edit");
  });
});
describe("style token drafts", () => {
  it("parses every nonblank valid line", () => expect(textToTokens("sm: 8px\n\nlarge: 1.5rem")).toEqual([{ name: "sm", value: "8px" }, { name: "large", value: "1.5rem" }]));
  it.each(["missing separator", "empty:", "bad: 1px;", ": 8px"])("rejects invalid lines: %s", line => expect(() => textToTokens(`sm: 8px\n\n${line}`)).toThrow("Line 3:"));
});
