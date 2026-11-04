// Records one real AI review as a test fixture, through the app itself.
//
// Run `npm run dev` with an AI key in .env.local first, then:
//   node scripts/record-ai-fixture.mjs [baseUrl] [outFile]
// Defaults: http://localhost:3000 and tests/fixtures/ai-review.json.
//
// The script opens the sample project in a fresh browser profile and clicks "Ask AI for a second opinion", so the
// images, brief and measured context sent to the model are exactly what the app sends. It saves the server's
// validated answer (summary, observations, uncertainty, provider and model) and never sees or stores the key: the key
// stays in the server process. As a last check it refuses to write a file that contains a key from .env.local.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const out = process.argv[3] ?? "tests/fixtures/ai-review.json";

const say = (message) => process.stdout.write(`${message}\n`);

function fail(message) {
  console.error(`Not recorded: ${message}`);
  process.exit(1);
}

// 1. Is AI review configured on that server? The status route reports provider and model only, never the key.
let res;
try {
  res = await fetch(`${base}/api/review`);
} catch {
  fail(`couldn't reach ${base}. Start the app with \`npm run dev\` first.`);
}
const status = await res.json().catch(() => null);
if (!status)
  fail(
    `${base}/api/review didn't answer with JSON (HTTP ${res.status}). Is this a static build? AI review needs \`npm run dev\` or \`npm run build && npm start\`.`,
  );
if (!status.configured) fail(status.reason ?? "AI review is off on that server.");
say(`AI review is on: ${status.provider} · ${status.model}`);

// 2. Drive the real app: fresh profile, sample project, ask the model.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let body;
try {
  await page.goto(`${base}/`);
  await page.getByRole("button", { name: "Open the sample project" }).click();
  await page.waitForURL(/\/project\/?\?id=/);
  await page.getByTestId("proofnote").first().waitFor({ timeout: 30_000 });
  say("Asking the model (this can take up to two minutes)…");
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/review") && r.request().method() === "POST", { timeout: 150_000 }),
    page.getByRole("button", { name: "Ask AI for a second opinion" }).click(),
  ]);
  body = await res.json();
  if (!body.ok) fail(`the server answered ${res.status()}: ${body.error ?? "no reason given"}`);
  // The page validates the answer again; wait until its AI-observed notes are on screen.
  await page.getByText("AI notes added").waitFor({ timeout: 15_000 });
  await mkdir("qa/screenshots", { recursive: true });
  await page.screenshot({ path: "qa/screenshots/08-ai-review-1440.png", fullPage: true });
} finally {
  await browser.close();
}
if (errors.length) fail(`the page reported errors: ${errors.join("; ")}`);

// 3. Write the fixture, after checking that no key from .env.local ended up in it.
const fixture = {
  recordedAt: new Date().toISOString(),
  provider: body.provider,
  model: body.model,
  input: "Sample project: public/samples/reference-poster.png and current-poster.png, the sample brief and the app's measured context",
  review: body.review,
};
const text = `${JSON.stringify(fixture, null, 2)}\n`;
const env = await readFile(".env.local", "utf8").catch(() => "");
const keys = [...env.matchAll(/^\s*(?:ANTHROPIC_API_KEY|OPENAI_API_KEY)\s*=\s*(\S+)/gm)].map((m) => m[1]).filter((k) => k.length >= 8);
if (keys.some((k) => text.includes(k))) fail("the answer contains an API key. Nothing was written.");

await mkdir(dirname(out), { recursive: true });
await writeFile(out, text);
say(`Recorded ${body.review.observations.length} AI observations to ${out}`);
say("Screenshot: qa/screenshots/08-ai-review-1440.png");
