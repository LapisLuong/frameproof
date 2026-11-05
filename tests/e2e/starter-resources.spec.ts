import { expect, test } from "@playwright/test";

test("gallery defers offscreen previews and the editor keeps untouched artwork during a drag", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/library");
  const previews = page.getByTestId("builtin-library").locator(".design-card-preview");
  await expect(previews.first().locator("svg")).toBeVisible();
  await expect(previews.last().locator("svg")).toHaveCount(0);
  await previews.last().scrollIntoViewIfNeeded();
  await expect(previews.last().locator("svg")).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: /Open editable template: Dạ hành khúc/ }).click();
  const canvas = page.getByTestId("design-canvas");
  const stationary = await canvas.locator('[data-layer="Moon"]').elementHandle();
  const title = canvas.locator('[data-layer="da"]');
  const line = title.locator("tspan").first();
  const before = await line.getAttribute("x");
  const box = await title.boundingBox();
  if (!box || !stationary) throw new Error("The template has not rendered.");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 34, y + 23, { steps: 8 });
  await page.mouse.up();
  await expect(line).not.toHaveAttribute("x", before!);
  expect(await stationary.evaluate((node) => node.isConnected)).toBe(true);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(line).toHaveAttribute("x", before!);
});

test("built-in infographic opens as an editable design @responsive", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("Search built-in resources").fill("infographic");
  const shelf = page.getByTestId("builtin-library");
  await expect(shelf.getByRole("list", { name: "Built-in templates" }).getByRole("listitem")).toHaveCount(2);
  await shelf.getByRole("button", { name: /Open editable template: Bản đồ ý tưởng/ }).click();
  await page.waitForURL(/\/design\/?\?id=/);
  await expect(page.getByText("Bản đồ ý tưởng · infographic", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Bản đồ ý tưởng · infographic", { exact: true }).first()).toBeVisible();
});

test("analyzer measures a sample and composer picks up a style", async ({ page }) => {
  await page.goto("/analyze");
  await page.getByRole("button", { name: "Analyze sample: Night Market · reference poster" }).click();
  await expect(page.getByRole("heading", { name: "What the pixels show" })).toBeVisible();
  await expect(page.getByTestId("observation").first()).toBeVisible();
  await page.goto("/styles");
  const style = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Dạ khúc", exact: true }) });
  await style.getByRole("link", { name: "Create a concept using this style" }).click();
  await expect(page.getByText(/Starting with Dạ khúc/)).toBeVisible();
});
