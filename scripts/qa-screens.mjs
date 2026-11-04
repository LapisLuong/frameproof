// Visual QA: captures the main routes at 1440, 1024 and 390 px wide after loading the sample project.
// Usage: node scripts/qa-screens.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "qa/screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

await page.goto(`${base}/`);
await page.getByRole("heading", { name: "Desk" }).waitFor();
await page.screenshot({ path: `${out}/01-desk-empty-1440.png`, fullPage: true });

await page.getByRole("button", { name: "Open the sample project" }).click();
await page.waitForURL(/\/project\/?\?id=/);
await page.getByTestId("proofnote").first().waitFor({ timeout: 20000 });
const projectUrl = page.url();

const shots = [
  ["02-project", projectUrl],
  ["03-desk", `${base}/`],
];
for (const w of [1440, 1024, 390]) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  for (const [name, url] of shots) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  }
}

// Comparison modes at desktop width
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(projectUrl);
await page.getByTestId("proofnote").first().waitFor();
for (const mode of ["Slider", "Overlay", "Difference"]) {
  await page.getByRole("button", { name: mode, exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/04-mode-${mode.toLowerCase()}-1440.png` });
}

// Analyzer with the reference poster
await page.goto(`${base}/analyze`);
await page.getByTestId("upload-analyze").setInputFiles("public/samples/reference-poster.png");
await page.waitForURL(/asset=/);
await page.getByText("Contrast between two colours").waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/05-analyzer-1440.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${out}/05-analyzer-390.png`, fullPage: true });

// Library with one reference and the style editor
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/library`);
await page.getByRole("button", { name: "Add reference" }).click();
await page.getByLabel("Title", { exact: true }).fill("Night market poster study");
await page.getByLabel("Link to the original", { exact: true }).fill("https://example.com/poster");
await page.getByLabel("Tags", { exact: true }).fill("serif, warm, editorial");
await page.getByTestId("upload-reference").setInputFiles("public/samples/reference-poster.png");
await page.getByRole("button", { name: "Save reference" }).click();
await page.getByTestId("reference-frame").first().waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/06-library-1440.png`, fullPage: true });

await page.goto(`${base}/analyze`);
await page.getByRole("link", { name: "reference-poster.png" }).first().click();
await page.getByRole("button", { name: "Save palette as a style" }).click();
await page.waitForURL(/\/styles\/?\?id=/);
await page.getByRole("heading", { name: "Palette" }).waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/07-styles-1440.png`, fullPage: true });

// Designer: Designs page, editor opened from a finished starter, and the brief composer with three concepts.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/`);
await page.getByTestId("desk-starters").getByRole("button").nth(1).click();
await page.waitForURL(/\/design\/?\?id=/);
await page.getByTestId("design-canvas").waitFor();
const editorUrl = page.url();
await page.goto(`${base}/compose`);
await page.getByLabel("Title", { exact: true }).fill("Dạ hành khúc");
await page.getByLabel("Subtitle (optional)", { exact: true }).fill("Coming soon");
await page.getByLabel("Information, one line each", { exact: true }).fill("Đêm 14 · 12 · 2026\nNhà hát Lớn Hà Nội");
await page.getByRole("button", { name: "The Great Wave" }).click();
await page.getByRole("button", { name: "Compose three concepts" }).click();
await page.getByTestId("concepts").waitFor();
for (const w of [1440, 1024, 390]) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  for (const [name, url] of [["08-designs", `${base}/design`], ["09-editor", editorUrl]]) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
  }
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/compose`);
await page.getByLabel("Title", { exact: true }).fill("Dạ hành khúc");
await page.getByLabel("Subtitle (optional)", { exact: true }).fill("Coming soon");
await page.getByRole("button", { name: "The Great Wave" }).click();
await page.getByRole("button", { name: "Compose three concepts" }).click();
await page.getByTestId("concepts").waitFor();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/10-compose-1440.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/10-compose-390.png`, fullPage: true });

// Picture tools: the "Fill an area" dialog (brush and typed rectangle) at each width. No model is loaded for this step.
for (const w of [1440, 1024, 390]) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
  await page.goto(editorUrl);
  await page.getByTestId("design-canvas").waitFor();
  await page.getByRole("button", { name: /^Portrait slot/ }).first().click();
  await page.getByRole("button", { name: "Fill an area…" }).click();
  await page.getByRole("button", { name: "Fill painted area" }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/12-fill-area-${w}.png` });
  await page.keyboard.press("Escape");
}

// Campaign formats from the editor's design: banner and avatar.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(editorUrl);
await page.getByRole("button", { name: "Campaign formats" }).click();
await page.waitForURL(/\/campaign\/?\?id=/);
for (const [fmt, file] of [["Banner 3:1", "11-campaign-banner"], ["Avatar 1:1 (circle-safe)", "11-campaign-avatar"]]) {
  await page.getByRole("button", { name: fmt }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${file}-1440.png`, fullPage: true });
}
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/11-campaign-avatar-390.png`, fullPage: true });

await browser.close();
process.stdout.write(errors.length ? `ERRORS:\n${errors.join("\n")}\n` : "no page errors\n");
