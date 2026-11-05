import { expect, test } from "@playwright/test";

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
