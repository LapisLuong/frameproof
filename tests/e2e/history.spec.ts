import { expect, test, type Page } from "@playwright/test";

const REF = "public/samples/reference-poster.png";

async function openSample(page: Page) {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("frameproof");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.reload();
  await page.getByRole("button", { name: "Open the sample project" }).click();
  await page.waitForURL(/\/project\/?\?id=/);
  await expect(page.getByTestId("proofnote").first()).toBeVisible({ timeout: 20_000 });
}

const currentWidth = (page: Page) =>
  page
    .getByRole("img", { name: "Current design", exact: true })
    .first()
    .evaluate((img) => (img as HTMLImageElement).naturalWidth);

test.describe("Review history", () => {
  test("an earlier review shows the image pair it measured, and unsaved notes are not dropped on switch", async ({ page }) => {
    await openSample(page);
    await expect.poll(() => currentWidth(page)).toBe(1080);

    // Replace the current design: the stage shows the new upload straight away.
    await page.getByTestId("upload-current").setInputFiles(REF);
    await expect.poll(() => currentWidth(page)).toBe(1240);
    await page.getByTestId("run-review").click();
    await expect(page.getByLabel("Review version")).toHaveValue(/.+/);
    await expect(page.locator("#rev-select option")).toHaveCount(2);

    // Going back to review 1 puts its own pair on the stage, with its marks.
    const select = page.getByLabel("Review version");
    const [v2, v1] = await page.locator("#rev-select option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    await select.selectOption(v1!);
    await expect(page.getByText(/The artwork shows the pair it measured/)).toBeVisible();
    await expect.poll(() => currentWidth(page)).toBe(1080);
    await expect(page.locator(".artmark").first()).toBeVisible();

    // Unsaved notes ask before the version changes.
    await page.getByLabel("Your notes on this review").fill("Keep the red title.");
    await select.selectOption(v2!);
    await expect(page.getByRole("alertdialog")).toContainText("Discard unsaved changes?");
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(select).toHaveValue(v1!);
    await expect(page.getByLabel("Your notes on this review")).toHaveValue("Keep the red title.");
    await select.selectOption(v2!);
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(select).toHaveValue(v2!);
    await expect.poll(() => currentWidth(page)).toBe(1240);
  });
});
