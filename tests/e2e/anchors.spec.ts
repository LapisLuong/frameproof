import { expect, test, type Page } from "@playwright/test";

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
  await page.waitForURL(/\/projects\//);
  await expect(page.getByTestId("proofnote").first()).toBeVisible({ timeout: 20_000 });
}

test.describe("Numbered marks on the artwork", () => {
  test("a located note puts the same number on both images, and the two stay linked @responsive", async ({ page }) => {
    await openSample(page);
    const note = page.getByTestId("proofnote").filter({ hasText: "The centre of detail has moved" });
    await expect(note).toBeVisible();
    await expect(note.getByTestId("note-scope")).toHaveText("On the artwork");
    const n = (await note.locator(".proofmark").innerText()).trim();

    // Notes stay in priority order: the first note is whole-image and high priority.
    await expect(page.getByTestId("proofnote").first().getByTestId("note-scope")).toHaveText("Whole image");

    const marks = page.getByTestId("artmark");
    const narrow = (page.viewportSize()?.width ?? 1440) <= 640;
    await expect(marks).toHaveCount(narrow ? 1 : 2);
    for (const m of await marks.all()) await expect(m).toHaveText(n);

    // Mark → note: the note is selected and takes focus.
    await marks.first().click();
    await expect(note).toHaveAttribute("data-selected", "true");
    await expect(note).toBeFocused();
    await expect(marks.first()).toHaveAttribute("aria-pressed", "true");

    // Resolving the note removes its marks; marks only show in side by side.
    await note.getByRole("button", { name: /Mark resolved/ }).click();
    await expect(marks).toHaveCount(0);
  });

  test("marks are hidden in layered modes and say where to find them", async ({ page }) => {
    await openSample(page);
    await page.getByRole("button", { name: "Overlay" }).click();
    await expect(page.getByTestId("artmark")).toHaveCount(0);
    await expect(page.getByText("Numbered marks show in side by side.")).toBeVisible();
  });
});
