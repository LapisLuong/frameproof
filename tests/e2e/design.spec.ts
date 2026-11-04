import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function freshStart(page: Page) {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("frameproof");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Desk" })).toBeVisible();
}

async function bundleWith(name: string, colour: string) {
  const png = await sharp({ create: { width: 64, height: 96, channels: 3, background: colour } }).png().toBuffer();
  const now = 1_700_000_000_000;
  return JSON.stringify({
    format: "frameproof.design-bundle",
    version: 1,
    exportedAt: now,
    doc: {
      schema: "frameproof.design", version: 1, id: "design_same", name, width: 640, height: 960, background: "#101d54", templateId: null, projectId: null, createdAt: now, updatedAt: now,
      layers: [{ id: "bg", name: "Background", type: "image", resourceId: "res_shared-id", x: 0, y: 0, w: 640, h: 960 }],
    },
    resources: [{ id: "res_shared-id", kind: "image", name: `${name} picture`, mime: "image/png", bytes: png.length, width: 64, height: 96, licence: { id: "own", author: "Test", source: "test" }, tags: [], createdAt: now, updatedAt: now, data: png.toString("base64") }],
  });
}

test.describe("Designer first run", () => {
  test("the Desk shows finished starters that open straight into the editor", async ({ page }) => {
    await freshStart(page);
    const starters = page.getByTestId("desk-starters").getByRole("button");
    await expect(starters).toHaveCount(6);
    await expect(page.getByRole("link", { name: "Create from a brief" })).toBeVisible();
    await starters.first().click();
    await expect(page).toHaveURL(/\/design\?id=/);
    await expect(page.getByTestId("design-canvas")).toBeVisible();
    await expect(page.getByTestId("doc-palette")).toBeVisible();
  });

  test("a palette change recolours linked layers in one undo step", async ({ page }) => {
    await freshStart(page);
    await page.getByTestId("desk-starters").getByRole("button").first().click();
    await expect(page.getByTestId("design-canvas")).toBeVisible();
    const svgHtml = () => page.locator(".design-svg").innerHTML();
    const before = await svgHtml();
    const lightness = page.getByTestId("swatch-editor").getByLabel("Lightness");
    await lightness.focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(svgHtml).not.toBe(before);
    await page.getByRole("button", { name: "Compare with before" }).click();
    await expect.poll(svgHtml).toBe(before);
    await page.getByRole("button", { name: "Back to current" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(svgHtml).toBe(before);
  });
});

test.describe("Campaign formats", () => {
  test("recomposes a design for a banner and saves a variant as its own design", async ({ page }) => {
    await freshStart(page);
    await page.getByTestId("desk-starters").getByRole("button").first().click();
    await expect(page.getByTestId("design-canvas")).toBeVisible();
    const sourceUrl = page.url();
    await page.getByRole("button", { name: "Campaign formats" }).click();
    await expect(page).toHaveURL(/\/campaign\/?\?id=/);
    await page.getByRole("button", { name: "Banner 3:1" }).click();
    const variants = page.getByTestId("campaign-variants").locator("> li");
    await expect(variants).toHaveCount(3);
    await expect(variants.first()).toContainText("Recomposed by rule");
    await page.getByRole("button", { name: "Standee 80 × 180 cm" }).click();
    await expect(page.getByText("85 DPI").first()).toBeVisible();
    await page.getByRole("button", { name: "Banner 3:1" }).click();
    await variants.first().getByRole("button", { name: "Save and edit" }).click();
    await expect(page).toHaveURL(/\/design\?id=/);
    expect(page.url()).not.toBe(sourceUrl);
    await expect(page.getByLabel("Width")).toHaveValue("1500");
  });
});

test.describe("Design file import", () => {
  test("a file over the size limit is refused before it's read", async ({ page }) => {
    await freshStart(page);
    await page.goto("/design");
    const big = join(tmpdir(), `frameproof-big-${process.pid}.json`);
    await writeFile(big, Buffer.alloc(61 * 1024 * 1024, 32));
    await page.locator("#import-design").setInputFiles(big);
    await rm(big);
    await expect(page.getByRole("alert").filter({ hasText: "at most 60 MB" })).toBeVisible();
  });

  test("a second file with the same resource id doesn't overwrite the first one's picture", async ({ page }) => {
    await freshStart(page);
    const imp = async (text: string) => {
      await page.goto("/design");
      await page.locator("#import-design").setInputFiles({ name: "design.json", mimeType: "application/json", buffer: Buffer.from(text) });
      await expect(page).toHaveURL(/\/design\?id=/);
      return page.url();
    };
    const firstUrl = await imp(await bundleWith("First", "#00aa55"));
    await imp(await bundleWith("Second", "#ff00aa"));
    const ids = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const open = indexedDB.open("frameproof");
          open.onsuccess = () => {
            const req = open.result.transaction("resources").objectStore("resources").getAllKeys();
            req.onsuccess = () => resolve(req.result.map(String));
          };
        }),
    );
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain("res_shared-id");
    await page.goto(firstUrl);
    const exported = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export design file" }).click();
    let text = "";
    for await (const chunk of await (await exported).createReadStream()) text += chunk.toString();
    const bundle = JSON.parse(text) as { doc: { name: string }; resources: Array<{ data: string }> };
    expect(bundle.doc.name).toBe("First");
    const { data } = await sharp(Buffer.from(bundle.resources[0]!.data, "base64")).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([0x00, 0xaa, 0x55]);
  });
});
