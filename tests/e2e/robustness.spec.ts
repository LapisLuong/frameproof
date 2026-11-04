import { expect, test, type Page } from "@playwright/test";
async function failWrites(page: Page) {
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException("Storage is full. Try again.", "QuotaExceededError"); };
    IDBObjectStore.prototype.delete = function () { throw new DOMException("Storage is full. Try again.", "QuotaExceededError"); };
  });
}
test("Desk keeps a draft on internal navigation and failed save", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Name", { exact: true }).fill("Draft poster");
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Discard unsaved changes?");
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Draft poster");
  await failWrites(page);
  await page.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(page.getByText("Storage is full. Try again.")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Draft poster");
});
test("Library cancellation and save failure preserve the draft", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Add reference", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Draft reference");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Draft reference");
  await failWrites(page);
  await page.getByRole("button", { name: "Save reference", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Storage is full. Try again.");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Draft reference");
});
test("Styles reject invalid token lines and retain drafts after failed writes and deletes", async ({ page }) => {
  await page.goto("/styles");
  await page.getByRole("button", { name: "New style", exact: true }).click();
  const spacing = page.getByLabel("Spacing tokens");
  await spacing.fill("sm: 8px\ninvalid line");
  await page.getByRole("button", { name: "Save style", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Line 2:");
  await expect(spacing).toHaveValue("sm: 8px\ninvalid line");
  await page.getByRole("link", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await spacing.fill("sm: 8px");
  await failWrites(page);
  await page.getByRole("button", { name: "Save style", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Storage is full. Try again.");
  await expect(spacing).toHaveValue("sm: 8px");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete style", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Storage is full. Try again.");
});
