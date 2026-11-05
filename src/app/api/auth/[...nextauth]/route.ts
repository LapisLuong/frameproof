import type { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { authOrigin, matchesAuthHost } from "@/lib/security/export-access";

export const runtime = "nodejs";

function handle(method: "GET" | "POST", request: NextRequest) {
  const origin = authOrigin();
  if (!origin) return new Response("Google sign-in is not configured.", { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!matchesAuthHost(request, origin)) return new Response("Unrecognized app host.", { status: 403, headers: { "Cache-Control": "no-store" } });
  return handlers[method](request);
}

export const GET = (request: NextRequest) => handle("GET", request);
export const POST = (request: NextRequest) => handle("POST", request);
