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

test.describe("Picture tools", () => {
  // The model itself is exercised by the runtime's own tests; here a stand-in worker checks the editor's flow:
  // confirmation before any download, progress, cancel, preview, and accept as a new linked picture.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      class FakeWorker {
        onmessage: ((e: { data: unknown }) => void) | null = null;
        onerror: (() => void) | null = null;
        onmessageerror: (() => void) | null = null;
        terminated = false;
        terminate() {
          this.terminated = true;
          (window as unknown as { __terminated: number }).__terminated = ((window as unknown as { __terminated?: number }).__terminated ?? 0) + 1;
        }
        async postMessage(msg: { mask?: Blob }) {
          const send = (data: unknown) => !this.terminated && this.onmessage?.({ data });
          const inpaint = !!msg?.mask;
          const progress = { stage: "download", loaded: 50 * 1048576, total: 200 * 1048576 };
          send(inpaint ? { progress } : { type: "progress", progress });
          if ((window as unknown as { __hang?: boolean }).__hang) return;
          await new Promise((r) => setTimeout(r, 150));
          if (inpaint) {
            // Record how much of the mask was painted, so the test can check what the tool was given.
            const bmp = await createImageBitmap(msg.mask!);
            const c = new OffscreenCanvas(bmp.width, bmp.height);
            const g = c.getContext("2d")!;
            g.drawImage(bmp, 0, 0);
            const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
            let white = 0;
            for (let i = 0; i < d.length; i += 4) if (d[i] === 255) white++;
            (window as unknown as { __mask: unknown }).__mask = { width: bmp.width, height: bmp.height, white };
            const png = await c.convertToBlob({ type: "image/png" });
            send({ result: { png, width: bmp.width, height: bmp.height, ms: { load: 1, run: 2 } } });
            return;
          }
          const c = new OffscreenCanvas(40, 30);
          const g = c.getContext("2d")!;
          g.fillStyle = "#c65a42";
          g.fillRect(10, 5, 20, 20);
          const png = await c.convertToBlob({ type: "image/png" });
          const model = { name: "BEN2", licence: "MIT", source: "https://huggingface.co/onnx-community/BEN2-ONNX", bytes: 219121675 };
          send({ type: "result", result: { png, width: 40, height: 30, model, ms: { load: 1, run: 2 } } });
        }
      }
      (window as unknown as { Worker: unknown }).Worker = FakeWorker;
    });
  });

  test("asks first, can be cancelled, and saves the result as a new picture", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => !r.url().startsWith("http://localhost") && !r.url().startsWith("data:") && !r.url().startsWith("blob:") && external.push(r.url()));
    await freshStart(page);
    await page.getByTestId("desk-starters").getByRole("button").first().click();
    await page.getByRole("button", { name: /^Portrait slot/ }).first().click();
    await page.getByRole("button", { name: "Remove background…" }).click();
    const dialog = page.getByRole("dialog", { name: "Remove background" });
    await expect(dialog).toContainText("about 209 MB");
    await expect(dialog).toContainText("your picture is not sent anywhere");

    await page.evaluate(() => ((window as unknown as { __hang: boolean }).__hang = true));
    await dialog.getByRole("button", { name: "Remove background" }).click();
    await expect(dialog).toContainText("Downloading the model: 50 MB of 200 MB");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog.getByRole("button", { name: "Remove background" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __terminated?: number }).__terminated)).toBe(1);

    await page.evaluate(() => ((window as unknown as { __hang: boolean }).__hang = false));
    await dialog.getByRole("button", { name: "Remove background" }).click();
    await expect(dialog.getByRole("img", { name: /background removed/ })).toBeVisible();
    await expect(dialog).toContainText("40 × 30 px");
    await dialog.getByRole("button", { name: "Use the cut-out" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Picture", { exact: true })).toHaveValue(/^res_/);
    await expect(page.getByLabel("Picture", { exact: true }).locator("option:checked")).toContainText("(cut-out)");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByLabel("Picture", { exact: true }).locator("option:checked")).not.toContainText("(cut-out)");
    expect(external).toEqual([]);
  });

  test("fills a painted area: the mask is what was painted, and the result is a new picture", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => !r.url().startsWith("http://localhost") && !r.url().startsWith("data:") && !r.url().startsWith("blob:") && external.push(r.url()));
    await freshStart(page);
    await page.getByTestId("desk-starters").getByRole("button").first().click();
    await page.getByRole("button", { name: /^Portrait slot/ }).first().click();
    await page.getByRole("button", { name: "Fill an area…" }).click();
    const dialog = page.getByRole("dialog", { name: "Fill an area" });
    await expect(dialog).toContainText("LaMa");
    const fill = dialog.getByRole("button", { name: "Fill painted area" });
    await expect(fill).toBeDisabled();

    const canvas = dialog.getByTestId("inpaint-canvas");
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, { steps: 6 });
    await page.mouse.up();
    await expect(fill).toBeEnabled();
    await dialog.getByRole("button", { name: "Undo stroke" }).click();
    await expect(fill).toBeDisabled();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, { steps: 6 });
    await page.mouse.up();

    await page.evaluate(() => ((window as unknown as { __hang: boolean }).__hang = true));
    await fill.click();
    await expect(dialog).toContainText("Downloading the model");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(fill).toBeEnabled(); // back on the same mask

    await page.evaluate(() => ((window as unknown as { __hang: boolean }).__hang = false));
    await fill.click();
    await expect(dialog.getByRole("button", { name: "Use the filled picture" })).toBeVisible();
    await expect(dialog).toContainText("reconstruction");
    const mask = await page.evaluate(() => (window as unknown as { __mask: { width: number; height: number; white: number } }).__mask);
    expect([mask.width, mask.height]).toEqual([2000, 1367]); // the picture's own size, not the screen's
    expect(mask.white).toBeGreaterThan(1000);
    expect(mask.white).toBeLessThan(2000 * 1367 * 0.2);
    await dialog.getByRole("button", { name: "Use the filled picture" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Picture", { exact: true }).locator("option:checked")).toContainText("(filled)");
    await expect(page.getByTestId("save-state")).toHaveText("Saved in this browser");
    await page.reload();
    await page.getByRole("button", { name: /^Portrait slot/ }).first().click();
    await expect(page.getByLabel("Picture", { exact: true }).locator("option:checked")).toContainText("(filled)");
    expect(external).toEqual([]);
  });
});

test.describe("Picture tools without a pointer", () => {
  test.beforeEach(async ({ page }) => {
    // A stand-in inpainting worker that counts runs, and a switch that fails the next writes to the resources store
    // (as a full disk or a blocked database would).
    await page.addInitScript(() => {
      const w = window as unknown as { __runs: number; __mask: unknown; __failResourceWrites?: number; Worker: unknown };
      w.__runs = 0;
      w.Worker = class {
        onmessage: ((e: { data: unknown }) => void) | null = null;
        terminate() {}
        async postMessage(msg: { mask: Blob }) {
          w.__runs++;
          const bmp = await createImageBitmap(msg.mask);
          const c = new OffscreenCanvas(bmp.width, bmp.height);
          const g = c.getContext("2d")!;
          g.drawImage(bmp, 0, 0);
          const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
          let white = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] === 255) white++;
          w.__mask = { width: bmp.width, height: bmp.height, white };
          const png = await c.convertToBlob({ type: "image/png" });
          this.onmessage?.({ data: { result: { png, width: bmp.width, height: bmp.height, ms: { load: 1, run: 2 } } } });
        }
      };
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
        if (this.name === "resources" && (w.__failResourceWrites ?? 0) > 0) {
          w.__failResourceWrites!--;
          throw new DOMException("The browser's storage is full.", "QuotaExceededError");
        }
        return put.apply(this, args);
      };
    });
  });

  test("a typed rectangle marks the area, and a failed save keeps the result for Retry save", async ({ page }) => {
    await freshStart(page);
    await page.getByTestId("desk-starters").getByRole("button").first().click();
    await page.getByRole("button", { name: /^Portrait slot/ }).first().click();
    await page.getByRole("button", { name: "Fill an area…" }).click();
    const dialog = page.getByRole("dialog", { name: "Fill an area" });
    const rect = dialog.getByRole("group", { name: /Or mark a rectangle/ });
    for (const [label, v] of [["X", "100"], ["Y", "200"], ["Width", "300"], ["Height", "50"]] as const) {
      await rect.getByLabel(label, { exact: true }).fill(v);
    }
    await rect.getByRole("button", { name: "Add this rectangle" }).focus();
    await page.keyboard.press("Enter");
    const fill = dialog.getByRole("button", { name: "Fill painted area" });
    await expect(fill).toBeEnabled();
    await fill.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Use the filled picture" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __mask: unknown }).__mask)).toEqual({ width: 2000, height: 1367, white: 300 * 50 });

    await page.evaluate(() => ((window as unknown as { __failResourceWrites: number }).__failResourceWrites = 1));
    await dialog.getByRole("button", { name: "Use the filled picture" }).click();
    await expect(dialog.getByRole("alert")).toContainText("couldn't be saved");
    await expect(dialog.getByRole("img", { name: /painted area filled/ })).toBeVisible(); // the result is still here
    await dialog.getByRole("button", { name: "Retry save" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel("Picture", { exact: true }).locator("option:checked")).toContainText("(filled)");
    expect(await page.evaluate(() => (window as unknown as { __runs: number }).__runs)).toBe(1); // no second model run
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
