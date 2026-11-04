import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const png = (background: { r: number; g: number; b: number; alpha: number }) =>
  sharp({ create: { width: 300, height: 200, channels: 4, background } })
    .png()
    .toBuffer();

async function analyze(page: Page, name: string, buffer: Buffer) {
  await page.goto("/analyze");
  await page.getByTestId("upload-analyze").setInputFiles({ name, mimeType: "image/png", buffer });
  await page.waitForURL(/asset=/);
  await expect(page.getByTestId("observation").first()).toBeVisible();
}

async function exportMd(page: Page) {
  const [md] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export analysis (.md)" }).click()]);
  return readFile((await md.path())!, "utf8");
}

test.describe("Analyzer observations at the edges", () => {
  test("a solid image gets no detail position, on screen or in the export", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await analyze(page, "solid.png", await png({ r: 244, g: 241, b: 234, alpha: 1 }));
    const obs = page.getByTestId("observations");
    await expect(obs).toContainText("No edges to locate");
    await expect(obs).not.toContainText(/Detail is spread|Detail gathers|ninth/);
    const md = await exportMd(page);
    expect(md).toContain("### No edges to locate");
    expect(md).not.toMatch(/Detail is spread|Detail gathers|Densest ninth/);
    expect(errors).toEqual([]);
  });

  test("a fully transparent image says there are no opaque pixels, not a neutral palette", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await analyze(page, "clear.png", await png({ r: 0, g: 0, b: 0, alpha: 0 }));
    const obs = page.getByTestId("observations");
    await expect(obs).toContainText("No opaque pixels to measure");
    await expect(obs).not.toContainText(/neutral|muted/);
    const md = await exportMd(page);
    expect(md).toContain("### No opaque pixels to measure");
    expect(md).not.toMatch(/neutral|muted/);
    const [json] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export JSON" }).click()]);
    const data = JSON.parse(await readFile((await json.path())!, "utf8")) as { observations: Array<{ id: string }> };
    expect(data.observations.map((o) => o.id)).not.toContain("strong-colour");
    expect(errors).toEqual([]);
  });
});
