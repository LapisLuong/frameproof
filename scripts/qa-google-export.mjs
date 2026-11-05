// Test the actual session endpoint and export dialog without using a real Google account.
// Run after npm run build. The temporary server binds to loopback and exits after the test.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { encode } from "next-auth/jwt";

const port = process.env.EXPORT_QA_PORT ?? "3114";
const origin = `http://127.0.0.1:${port}`;
const secret = randomBytes(32).toString("hex");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port, "-H", "127.0.0.1"], {
  env: { ...process.env, AI_PROVIDER: "", AUTH_URL: origin, AUTH_GOOGLE_ID: "qa-only", AUTH_GOOGLE_SECRET: "qa-only", AUTH_SECRET: secret, FRAMEPROOF_LOCAL_EXPORTS: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
const ready = new Promise((resolve, reject) => {
  child.stdout.on("data", (chunk) => { if (String(chunk).includes("Ready in")) resolve(); });
  child.once("exit", (code) => reject(new Error(`QA server exited: ${code}`)));
  child.once("error", reject);
});
const cookie = "authjs.session-token";
const session = (maxAge) => encode({ secret, salt: cookie, maxAge, token: { sub: "qa", email: "qa@example.test" } });
let browser;
try {
  let timer;
  try { await Promise.race([ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("QA server did not start")), 10_000); })]); }
  finally { clearTimeout(timer); }
  const gate = async (value) => {
    const res = await fetch(origin + "/api/export-access", { headers: value ? { Cookie: `${cookie}=${value}` } : {} });
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    return res.status;
  };
  assert.equal(await gate(), 401);
  assert.equal(await gate("forged-cookie"), 401);
  assert.equal(await gate(await session(-90)), 401);
  assert.equal(await gate(await session(300)), 204);
  const signIn = await fetch(origin + "/api/auth/signin");
  assert.equal(signIn.status, 200);
  assert.match(await signIn.text(), /Sign in with Google/i);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(origin + "/library");
  await page.getByRole("button", { name: /Open editable template: Dạ hành khúc/ }).click();
  await page.getByTestId("design-canvas").waitFor();
  const editor = page.url();
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to download" });
  await dialog.waitFor();
  assert.equal(await dialog.getByRole("link", { name: "Sign in with Google" }).getAttribute("target"), "_blank");
  await page.context().addCookies([{ name: cookie, value: await session(300), url: origin, httpOnly: true, sameSite: "Lax" }]);
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Retry download" }).click()]);
  assert.match(download.suggestedFilename(), /\.png$/);
  assert.equal(page.url(), editor);
  process.stdout.write("Google export QA: guest editor, 401 without session, forged and expired cookies rejected, verified session exports in the same editor tab.\n");
} finally {
  await browser?.close();
  child.kill();
}
