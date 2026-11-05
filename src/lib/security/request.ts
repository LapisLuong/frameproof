const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOOPBACK_AUTHORITY = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

/** Both the server URL and the incoming HTTP authority must identify the local machine. */
export function localAiOrigin(req: Request): string | null {
  try {
    const target = new URL(req.url);
    if (!LOOPBACK.has(target.hostname) || !["http:", "https:"].includes(target.protocol)) return null;
    // Next can normalize the URL to the server's hostname; inspect the original Host too.
    const host = req.headers.get("host") ?? target.host;
    if (!LOOPBACK_AUTHORITY.test(host)) return null;
    return new URL(`${target.protocol}//${host}`).origin;
  } catch {
    return null;
  }
}

/** Browser request isolation for the local paid AI operations. This is not authentication or rate limiting. */
export function rejectUnsafeAiRequest(req: Request): Response | null {
  const deny = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  const expected = localAiOrigin(req);
  if (!expected) return deny("AI is only available from FrameProof on this computer.", 403);
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return deny("Run AI from this FrameProof app, not another website.", 403);
  const origin = req.headers.get("origin");
  if (origin !== null) {
    try {
      const parsed = new URL(origin);
      // Compare complete origins; suffix/prefix matches would trust attacker-controlled domains.
      if (parsed.origin !== origin || origin !== expected) return deny("The request origin is not allowed.", 403);
    } catch {
      return deny("The request origin is not allowed.", 403);
    }
  } else if (site !== null && site !== "same-origin") {
    return deny("The request origin is missing.", 403);
  }
  // Headerless local scripts remain supported. Run the app on a loopback-bound listener.
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/;\s*boundary\s*=\s*(?:"[^"\r\n]+"|[^;\s]+)/i.test(contentType)) {
    return deny("Send images and context as multipart form data.", 415);
  }
  return null;
}
