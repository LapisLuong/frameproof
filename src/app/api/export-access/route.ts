import { auth } from "@/lib/auth";
import { allowsLocalExport, authOrigin, matchesAuthHost } from "@/lib/security/export-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const origin = authOrigin();
  if (!origin) {
    if (allowsLocalExport(request)) return new Response(null, { status: 204, headers });
    return Response.json({ error: "Downloads aren't available until Google sign-in is configured." }, { status: 503, headers });
  }
  if (!matchesAuthHost(request, origin)) return Response.json({ error: "Open FrameProof on its configured address to download." }, { status: 403, headers });
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Sign in with Google to download." }, { status: 401, headers });
  return new Response(null, { status: 204, headers });
}
