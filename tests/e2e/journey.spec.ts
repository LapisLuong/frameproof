import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const REF = "public/samples/reference-poster.png";
const CUR = "public/samples/current-poster.png";

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

test.describe("Event poster journey", () => {
  test("create, upload two images, compare, review, resolve, persist, export", async ({ page }) => {
    await freshStart(page);

    // Create the project
    await page.getByLabel("Name").fill("Event Poster");
    await page.getByLabel("Brief (optional)").fill("Student event poster, readable from three metres.");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/project\/?\?id=prj_/);
    await expect(page.getByRole("heading", { level: 1, name: /Event Poster/ })).toBeVisible();

    // Upload both images — the review runs automatically once both are in
    await page.getByTestId("upload-reference").setInputFiles(REF);
    await expect(page.getByText("reference-poster.png")).toBeVisible();
    await page.getByTestId("upload-current").setInputFiles(CUR);
    await expect(page.getByTestId("proofnote").first()).toBeVisible({ timeout: 20_000 });

    // Measured facts are genuine: sizes come from the files
    await expect(page.getByRole("cell", { name: "1240×1754 px" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "1080×1350 px" })).toBeVisible();
    // The format finding is measured and first (high priority)
    const first = page.getByTestId("proofnote").first();
    await expect(first).toContainText("Format differs from the reference");
    await expect(first).toContainText("Measured");
    // AI is off and says so; no AI-observed notes appear
    await expect(page.getByTestId("ai-state")).toContainText("Local measurements only");
    await expect(page.getByText("AI-observed", { exact: true })).toHaveCount(0);

    // Comparison modes work
    await page.getByRole("button", { name: "Slider", exact: true }).click();
    const split = page.getByRole("slider");
    await split.focus();
    await split.press("ArrowLeft");
    await expect(split).toHaveValue("49");
    await page.getByRole("button", { name: "Overlay", exact: true }).click();
    await expect(page.getByText("Current opacity")).toBeVisible();
    await page.getByRole("button", { name: "Difference", exact: true }).click();
    await expect(page.getByText(/of the area changed lightness/)).toBeVisible({ timeout: 10_000 });

    // Resolve the first note
    const countBefore = await page.getByTestId("issue-count").innerText();
    const total = Number(/of (\d+)/.exec(countBefore)![1]);
    await first.getByRole("button", { name: /Mark resolved/ }).click();
    await expect(page.getByTestId("issue-count")).toHaveText(`${total - 1} open of ${total}`);

    // Notes save
    await page.getByLabel("Your notes on this review").fill("Try a bigger serif title.");
    await page.getByRole("button", { name: "Save notes" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    // Persists across reload
    await page.reload();
    await expect(page.getByTestId("issue-count")).toHaveText(`${total - 1} open of ${total}`);
    await expect(page.getByLabel("Your notes on this review")).toHaveValue("Try a bigger serif title.");

    // Export Markdown and JSON
    const [md] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-md").click()]);
    expect(md.suggestedFilename()).toBe("event-poster-review-1.md");
    const mdText = await readFile((await md.path())!, "utf8");
    expect(mdText).toContain("# Revision brief — Event Poster");
    expect(mdText).toContain("## Resolved");
    expect(mdText).toContain("Format differs from the reference");
    expect(mdText).toContain("AI review was not run");

    const [js] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-json").click()]);
    const json = JSON.parse(await readFile((await js.path())!, "utf8"));
    expect(json.schema).toBe("frameproof.review/v1");
    expect(json.review.issues.length).toBe(total);
    expect(json.review.issues.filter((i: { resolved: boolean }) => i.resolved)).toHaveLength(1);
    expect(json.review.measurements.reference.width).toBe(1240);

    // A second review version keeps the first
    await page.getByTestId("run-review").click();
    await expect(page.getByLabel("Review version")).toContainText("Review 2");
    await expect(page.getByLabel("Review version").locator("option")).toHaveCount(2);

    // Desk lists the project
    await page.goto("/");
    await expect(page.getByTestId("project-row")).toContainText("Event Poster");
  });

  test("rejects a file that only pretends to be an image", async ({ page }) => {
    await freshStart(page);
    await page.getByLabel("Name").fill("Bad upload");
    await page.getByRole("button", { name: "Create project" }).click();
    await page.waitForURL(/\/project\/?\?id=/);
    await page
      .getByTestId("upload-reference")
      .setInputFiles({ name: "poster.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>not an image</svg>") });
    await expect(page.locator("main").getByRole("alert")).toContainText("isn't a PNG, JPEG, WebP or GIF");
    // nothing was saved
    await expect(page.getByText("poster.png")).toHaveCount(0);
  });
});

test.describe("Libraries", () => {
  test("switching analyzer images resets contrast to the displayed palette", async ({ page }) => {
    await freshStart(page);
    await page.goto("/analyze");
    await page.getByTestId("upload-analyze").setInputFiles(REF);
    await page.waitForURL(/asset=/);
    const firstUrl = page.url();
    await page.getByTestId("contrast-a").selectOption("#C65B43");
    await page.getByTestId("upload-analyze").setInputFiles(CUR);
    await page.waitForURL((url) => url.href !== firstUrl && url.searchParams.has("asset"));
    const colours = await page.getByTestId("contrast-a").locator("option").allTextContents();
    await expect(page.getByTestId("contrast-a")).toHaveValue(colours[1]!);
    await expect(page.getByTestId("contrast-b")).toHaveValue(colours[0]!);
  });

  test("inspiration library: add, search, filter, persist, delete", async ({ page }) => {
    await freshStart(page);
    await page.goto("/library");
    await page.getByRole("button", { name: "Add reference" }).click();
    const dialog = page.getByRole("dialog", { name: "Add reference" });
    await dialog.getByLabel("Title", { exact: true }).fill("Swiss poster grid");
    await page.getByLabel("Link to the original", { exact: true }).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save reference" }).click();
    await expect(dialog.getByRole("alert")).toContainText("http:// or https://");
    await page.getByLabel("Link to the original", { exact: true }).fill("example.com/grid");
    await dialog.getByLabel("Category").selectOption("Layout");
    await page.getByLabel("Tags", { exact: true }).fill("Grid, Swiss");
    await page.getByLabel("Collection").fill("Moodboard");
    await page.getByTestId("upload-reference").setInputFiles(REF);
    await page.getByRole("button", { name: "Save reference" }).click();
    await expect(page.getByTestId("reference-frame")).toHaveCount(1);

    await page.getByLabel("Search titles, tags and credits").fill("swiss");
    await expect(page.getByTestId("reference-frame")).toHaveCount(1);
    await page.getByLabel("Search titles, tags and credits").fill("nothing-matches");
    await expect(page.getByText("Nothing matches these filters.")).toBeVisible();
    await page.getByLabel("Search titles, tags and credits").fill("");
    await page.getByRole("toolbar", { name: "Category" }).getByRole("button", { name: "Motion" }).click();
    await expect(page.getByTestId("reference-frame")).toHaveCount(0);
    await page.getByRole("toolbar", { name: "Category" }).getByRole("button", { name: "Layout" }).click();
    await expect(page.getByTestId("reference-frame")).toHaveCount(1);

    await page.reload();
    await page.getByTestId("reference-frame").click();
    const link = page.getByRole("link", { name: /Open the original/ });
    await expect(link).toHaveAttribute("href", "https://example.com/grid");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete reference" }).click();
    await expect(page.getByTestId("reference-frame")).toHaveCount(0);
  });

  test("analyzer → style → CSS export", async ({ page }) => {
    await freshStart(page);
    await page.goto("/analyze");
    await page.getByTestId("upload-analyze").setInputFiles(REF);
    await page.waitForURL(/asset=/);
    await expect(page.getByTestId("contrast-ratio")).toHaveText(/:1$/);
    await page.getByTestId("contrast-a").selectOption("#C65B43");
    await page.getByTestId("contrast-b").selectOption("#F4F1EA");
    await expect(page.getByTestId("contrast-ratio")).toHaveText("3.73:1");
    await page.getByRole("button", { name: "Save palette as a style" }).click();
    await page.waitForURL(/styles\?id=/);
    await expect(page.getByText("Measured, 62% of pixels")).toBeVisible();
    await page.getByLabel("Display").fill("Lora");
    await page.getByLabel("Spacing tokens").fill("sm: 8px\nmd: 16px\nbad: url(x);}");
    await page.getByRole("button", { name: "Save style" }).click();
    // A click starts the async save; wait for the IndexedDB commit before reloading.
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Display")).toHaveValue("Lora");
    const [css] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSS variables" }).click()]);
    const text = await readFile((await css.path())!, "utf8");
    expect(text).toContain("--color-colour-1: #F4F1EA; /* measured from image */");
    expect(text).toContain("--space-sm: 8px;");
    expect(text).not.toContain("url(");
  });
});

test.describe("Server and platform", () => {
  test("AI route reports it is unconfigured and refuses to fabricate", async ({ request }) => {
    test.skip(process.env.STATIC_E2E === "1", "The static (GitHub Pages) build has no server and no AI route.");
    const status = await request.get("/api/review");
    expect(await status.json()).toMatchObject({ configured: false });
    const res = await request.post("/api/review", { multipart: { brief: "x" } });
    expect(res.status()).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, code: "not-configured" });
  });

  test("keyboard: skip link and visible focus", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("sample project loads with live findings @responsive", async ({ page }) => {
    await freshStart(page);
    await page.getByRole("button", { name: "Open the sample project" }).click();
    await page.waitForURL(/\/project\/?\?id=/);
    await expect(page.getByText("Sample", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("proofnote").first()).toBeVisible({ timeout: 20_000 });
    const measurements = page.getByRole("region", { name: /Measurements and methods/ });
    await measurements.focus();
    await expect(measurements).toBeFocused();
    await expect(measurements).toHaveCSS("overflow-x", "auto");
    if (page.viewportSize()!.width <= 640) {
      await expect(page.locator(".file-row").first()).toHaveCSS("display", "grid");
      await page.getByRole("button", { name: "Current", exact: true }).click();
      await expect(page.getByRole("img", { name: "Current design", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Reference", exact: true }).click();
      await expect(page.getByRole("img", { name: "Reference", exact: true })).toBeVisible();
      await measurements.scrollIntoViewIfNeeded();
      await measurements.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      expect(await measurements.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
    for (const path of ["/", "/analyze", "/library", "/styles", new URL(page.url()).pathname]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });

  test("reduced motion disables transitions", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const d = await page.evaluate(() => getComputedStyle(document.querySelector(".nav a")!).transitionDuration);
    expect(d).toBe("0s");
    await ctx.close();
  });
});
