import { describe, expect, it } from "vitest";
import { allowsLocalExport, authOrigin, matchesAuthHost, safeAuthReturn } from "@/lib/security/export-access";

const config: NodeJS.ProcessEnv = { NODE_ENV: "production", AUTH_URL: "https://frameproof.example", AUTH_SECRET: "test-secret-only-not-for-production", AUTH_GOOGLE_ID: "test-id", AUTH_GOOGLE_SECRET: "test-client-secret" };

describe("Google export access", () => {
  it("requires complete credentials and HTTPS outside local testing", () => {
    expect(authOrigin(config)?.origin).toBe("https://frameproof.example");
    expect(authOrigin({ ...config, AUTH_URL: "http://frameproof.example" })).toBeNull();
    expect(authOrigin({ ...config, AUTH_URL: "https://frameproof.example/path" })).toBeNull();
    expect(authOrigin({ ...config, AUTH_SECRET: "short" })).toBeNull();
    expect(authOrigin({ ...config, AUTH_URL: "http://localhost:3000" })?.origin).toBe("http://localhost:3000");
  });
  it("does not grant anonymous access on an unconfigured production server", () => {
    const local = new Request("http://localhost:3000/api/export-access");
    expect(allowsLocalExport(local, { NODE_ENV: "production" })).toBe(false);
    expect(allowsLocalExport(local, { NODE_ENV: "development" })).toBe(true);
    expect(allowsLocalExport(local, { NODE_ENV: "production", FRAMEPROOF_LOCAL_EXPORTS: "1" })).toBe(true);
    expect(allowsLocalExport(local, { NODE_ENV: "development", AUTH_URL: config.AUTH_URL })).toBe(false);
    expect(allowsLocalExport(new Request(local, { headers: { host: "frameproof.example" } }), { NODE_ENV: "development" })).toBe(false);
  });
  it("accepts only the configured host and same-origin OAuth returns", () => {
    const origin = authOrigin(config)!;
    expect(matchesAuthHost(new Request(origin), origin)).toBe(true);
    expect(matchesAuthHost(new Request(origin, { headers: { host: "frameproof.example.evil" } }), origin)).toBe(false);
    expect(safeAuthReturn("/design?id=example", origin)).toBe("https://frameproof.example/design?id=example");
    for (const redirect of ["//evil.example", "/\\evil.example", "javascript:alert(1)", "https://frameproof.example.evil/"]) {
      expect(safeAuthReturn(redirect, origin)).toBe(origin.href);
    }
  });
});
