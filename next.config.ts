import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * STATIC_EXPORT=1 builds plain files for GitHub Pages: no server, so no AI route and no response headers.
 * NEXT_PUBLIC_BASE_PATH is the sub-folder it is served from (e.g. /frameproof).
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // sharp is a native module used only by the AI route; keep it out of the bundle.
  serverExternalPackages: ["sharp"],
  ...(staticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        basePath,
        images: { unoptimized: true },
        env: { NEXT_PUBLIC_STATIC_EXPORT: "1" },
        // The AI route is parked during this build, so unit tests that import it can't resolve. `npm run typecheck`
        // and the normal build check everything; the Pages workflow runs typecheck before this build.
        typescript: { ignoreBuildErrors: true },
      }
    : {
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
