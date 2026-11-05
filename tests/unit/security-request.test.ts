import { describe, expect, it } from "vitest";
import { rejectUnsafeAiRequest } from "../../src/lib/security/request";

const url = "http://localhost:3100/api/direction";
const multipart = { "content-type": "multipart/form-data; boundary=frameproof" };
const request = (headers: Record<string, string>) => new Request(url, { method: "POST", headers });

describe("AI browser request isolation", () => {
  it("rejects a rebound domain even when its Origin matches the request URL", () => {
    const origin = "http://rebound.example:3100";
    for (const target of [origin + "/api/direction", url]) {
      const req = new Request(target, { method: "POST", headers: { ...multipart, host: "rebound.example:3100", origin, "sec-fetch-site": "same-origin" } });
      expect(rejectUnsafeAiRequest(req)?.status).toBe(403);
    }
  });
  it("accepts a loopback IP alias on a normalized Next request URL", () => {
    const req = request({ ...multipart, host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100", "sec-fetch-site": "same-origin" });
    expect(rejectUnsafeAiRequest(req)).toBeNull();
  });
  it("accepts the app and headerless local scripts", () => {
    expect(rejectUnsafeAiRequest(request({ ...multipart, origin: "http://localhost:3100", "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(rejectUnsafeAiRequest(request(multipart))).toBeNull();
  });
  it.each(["https://attacker.example", "http://localhost:3100.attacker.example", "http://localhost:3101", "null", "http://localhost:3100/", "not a URL"])("rejects foreign or malformed origin %s", (origin) => {
    expect(rejectUnsafeAiRequest(request({ ...multipart, origin }))?.status).toBe(403);
  });
  it.each(["cross-site", "same-site"])("rejects %s metadata even with a matching origin", (site) => {
    expect(rejectUnsafeAiRequest(request({ ...multipart, origin: "http://localhost:3100", "sec-fetch-site": site }))?.status).toBe(403);
  });
  it("rejects opaque browser origins and accepts same-origin metadata without Origin", () => {
    expect(rejectUnsafeAiRequest(request({ ...multipart, "sec-fetch-site": "none" }))?.status).toBe(403);
    expect(rejectUnsafeAiRequest(request({ ...multipart, "sec-fetch-site": "same-origin" }))).toBeNull();
  });
  it.each(["text/plain", "application/json", "application/x-www-form-urlencoded", "multipart/form-data", "multipart/form-data; boundary="])("rejects incorrect content type %s", (type) => {
    expect(rejectUnsafeAiRequest(request({ "content-type": type }))?.status).toBe(415);
  });
  it("accepts quoted boundaries and returns non-cacheable errors", () => {
    expect(rejectUnsafeAiRequest(request({ "content-type": 'multipart/form-data; boundary="frameproof"' }))).toBeNull();
    expect(rejectUnsafeAiRequest(request({ origin: "null" }))?.headers.get("cache-control")).toBe("no-store");
  });
});
