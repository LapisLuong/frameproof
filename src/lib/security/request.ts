/** Browser request isolation for paid AI operations. This is not authentication or rate limiting. */
export function rejectUnsafeAiRequest(req: Request): Response | null {
  const deny = (error: string, status: number) => Response.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return deny("Run AI from this FrameProof app, not another website.", 403);
  const origin = req.headers.get("origin");
  if (origin !== null) {
    try {
      const parsed = new URL(origin);
      // Compare complete origins; suffix/prefix matches would trust attacker-controlled domains.
      if (parsed.origin !== origin || origin !== new URL(req.url).origin) return deny("The request origin is not allowed.", 403);
    } catch {
      return deny("The request origin is not allowed.", 403);
    }
  } else if (site !== null && site !== "same-origin") {
    return deny("The request origin is missing.", 403);
  }
  // Headerless local scripts remain supported. A public deployment still needs authenticated access and quotas.
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/;\s*boundary\s*=\s*(?:"[^"\r\n]+"|[^;\s]+)/i.test(contentType)) {
    return deny("Send images and context as multipart form data.", 415);
  }
  return null;
}
