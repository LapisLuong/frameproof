import { expect, it, vi } from "vitest";
import { checkIds, DirectionAnswerSchema, requestDirection, type DirectionInput } from "@/lib/ai/direction";
import { ProviderError, type VisionProvider } from "@/lib/ai/provider";
const input: DirectionInput = {
  brief: { title: "Đêm nhạc", subtitle: "", lines: [], intent: "" },
  allowed: { fontIds: ["anton", "archivo"], templateIds: ["tpl_music"], imageIds: ["res_photo"] },
};
const answer = () => ({
  palette: [{ hex: "#ffffff", role: "ground" }, { hex: "#000000", role: "ink" }],
  fonts: { display: "anton", text: "archivo" },
  concepts: Array.from({ length: 3 }, () => ({ templateId: "tpl_music", photoOrder: ["res_photo"], emphasis: "title", note: "Nhịp điệu rõ ràng" })),
  notes: "Ba biến thể từ thư viện có sẵn",
});
const provider = (text: string): VisionProvider => ({ id: "openai", model: "fake", complete: vi.fn(async () => text) });
const images = [{ base64: "fixture", mime: "image/jpeg" as const }];
it.each([false, true])("accepts valid JSON with fences=%s", async (fenced) => {
  const raw = JSON.stringify(answer()); const fake = provider(fenced ? `\`\`\`json\n${raw}\n\`\`\`` : raw);
  expect(await requestDirection(fake, images, input)).toEqual(answer());
  expect(fake.complete).toHaveBeenCalledOnce();
});
it("rejects invalid JSON", async () => { await expect(requestDirection(provider("not JSON"), images, input)).rejects.toThrow("valid JSON"); });
it.each(["template", "font", "image"])("rejects an unknown %s id", async (kind) => {
  const value = answer();
  if (kind === "template") value.concepts[0]!.templateId = "tpl_unknown";
  if (kind === "font") value.fonts.display = "fraunces";
  if (kind === "image") value.concepts[0]!.photoOrder = ["res_unknown"];
  await expect(requestDirection(provider(JSON.stringify(value)), images, input)).rejects.toThrow(`Unknown ${kind} id`);
});
it.each([0, 2, 4])("rejects %s concepts", async (count) => {
  const value = answer(); value.concepts = Array.from({ length: count }, () => answer().concepts[0]!);
  await expect(requestDirection(provider(JSON.stringify(value)), images, input)).rejects.toThrow("direction format");
});
it("strips extra geometry from model output", async () => {
  const value = answer(); Object.assign(value.concepts[0]!, { x: 12, layers: [{ w: 200 }] }); Object.assign(value, { geometry: {} });
  expect(await requestDirection(provider(JSON.stringify(value)), images, input)).toEqual(answer());
});
it("checkIds returns valid answers and rejects unknown ids without fixing them", () => {
  const value = DirectionAnswerSchema.parse(answer());
  expect(checkIds(value, input.allowed)).toBe(value);
  expect(() => checkIds(value, { ...input.allowed, templateIds: [] })).toThrow(ProviderError);
  expect(value.concepts[0]!.templateId).toBe("tpl_music");
});
it("rejects duplicate photo ids", () => {
  const value = DirectionAnswerSchema.parse(answer()); value.concepts[0]!.photoOrder.push("res_photo");
  expect(() => checkIds(value, input.allowed)).toThrow("without duplicates");
});
it.each([0, 4])("rejects %s references before calling provider", async (count) => {
  const fake = provider(JSON.stringify(answer()));
  await expect(requestDirection(fake, Array.from({ length: count }, () => images[0]!), input)).rejects.toThrow("1–3");
  expect(fake.complete).not.toHaveBeenCalled();
});
it("passes cancellation to the provider and clears its timeout", async () => {
  vi.useFakeTimers();
  try {
    const fake: VisionProvider = { id: "openai", model: "fake", complete: async (_system, _user, _images, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new ProviderError("timeout")), { once: true })) };
    const result = expect(requestDirection(fake, images, input, 10)).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(10); await result; expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});

// Exercise the real route with local bytes and a fake provider; never make network requests.
import * as providerModule from "@/lib/ai/provider";
import { GET, POST } from "@/app/api/direction/route";
import sharp from "sharp";
const formRequest = (form: FormData) => new Request("http://localhost/api/direction", { method: "POST", body: form, headers: { "content-length": "4096" } });
const directionForm = () => { const form = new FormData(); form.set("brief", JSON.stringify(input.brief)); form.set("allowed", JSON.stringify(input.allowed)); return form; };
it("reports unconfigured status and returns 503 without reading a request body", async () => {
  const mock = vi.spyOn(providerModule, "getProviderConfig").mockReturnValue({ configured: false, reason: "No key" });
  try {
    expect(await (await GET()).json()).toEqual({ configured: false, reason: "No key" });
    const response = await POST(new Request("http://localhost/api/direction", { method: "POST" }));
    expect(response.status).toBe(503); expect((await response.json()).code).toBe("not-configured");
  } finally { mock.mockRestore(); }
});
it("enforces declared and streamed body caps", async () => {
  const fake = provider(JSON.stringify(answer()));
  const mock = vi.spyOn(providerModule, "getProviderConfig").mockReturnValue({ configured: true, provider: fake });
  try {
    for (const length of [undefined, "-1", "NaN", "50000000"]) {
      expect((await POST(new Request("http://localhost/api/direction", { method: "POST", headers: length ? { "content-length": length } : {} }))).status).toBe(413);
    }
    const body = new Uint8Array(3 * 15 * 1024 * 1024 + 256 * 1024 + 1);
    expect((await POST(new Request("http://localhost/api/direction", { method: "POST", body, headers: { "content-length": "1" } }))).status).toBe(413);
    expect(fake.complete).not.toHaveBeenCalled();
  } finally { mock.mockRestore(); }
});
it("validates JSON fields, reference counts and magic bytes", async () => {
  const fake = provider(JSON.stringify(answer()));
  const mock = vi.spyOn(providerModule, "getProviderConfig").mockReturnValue({ configured: true, provider: fake });
  try {
    const malformed = directionForm(); malformed.set("brief", "not-json");
    expect((await POST(formRequest(malformed))).status).toBe(400);
    expect((await POST(formRequest(directionForm()))).status).toBe(400);
    const tooMany = directionForm(); for (let i = 0; i < 4; i++) tooMany.append("reference", new Blob(["invalid"]));
    expect((await POST(formRequest(tooMany))).status).toBe(400);
    const invalid = directionForm(); invalid.append("reference", new Blob(["invalid"]));
    expect((await POST(formRequest(invalid))).status).toBe(415);
    expect(fake.complete).not.toHaveBeenCalled();
  } finally { mock.mockRestore(); }
});
it("re-encodes a valid image and returns a validated direction", async () => {
  const fake = provider(JSON.stringify(answer()));
  const mock = vi.spyOn(providerModule, "getProviderConfig").mockReturnValue({ configured: true, provider: fake });
  try {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const form = directionForm(); form.append("reference", new Blob([new Uint8Array(png)], { type: "image/png" }));
    const response = await POST(formRequest(form));
    expect(response.status).toBe(200); expect((await response.json()).direction).toEqual(answer());
    expect(fake.complete).toHaveBeenCalledWith(expect.any(String), expect.any(String), [expect.objectContaining({ mime: "image/jpeg" })], expect.any(AbortSignal));
  } finally { mock.mockRestore(); }
});
it.each([[400, 400], [401, 502], [429, 502]])("maps provider status %s to route status %s", async (status, expected) => {
  const fake: VisionProvider = { id: "openai", model: "fake", complete: async () => { throw new ProviderError("Provider failure", status); } };
  const mock = vi.spyOn(providerModule, "getProviderConfig").mockReturnValue({ configured: true, provider: fake });
  try {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const form = directionForm(); form.append("reference", new Blob([new Uint8Array(png)]));
    expect((await POST(formRequest(form))).status).toBe(expected);
  } finally { mock.mockRestore(); }
});
