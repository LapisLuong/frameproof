import { NextResponse } from "next/server";
import sharp from "sharp";
import { getProviderConfig, ProviderError, type PreparedImage } from "@/lib/ai/provider";
import { AllowedSchema, requestDirection } from "@/lib/ai/direction";
import { BriefSchema } from "@/lib/design/direction";
import { MAX_UPLOAD_BYTES, validateImageBytes } from "@/lib/image/validate";
import { BodyReadError, readBodyBytes } from "@/lib/security/body";
import { rejectUnsafeAiRequest } from "@/lib/security/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Long side of the copy sent to the model. Smaller is cheaper; 1280 keeps headline text legible. */
const MODEL_SIDE = 1280;

export async function GET() {
  const cfg = getProviderConfig();
  return NextResponse.json(
    cfg.configured ? { configured: true, provider: cfg.provider.id, model: cfg.provider.model } : { configured: false, reason: cfg.reason },
  );
}

async function prepare(file: FormDataEntryValue | null, label: string): Promise<PreparedImage> {
  if (!(file instanceof Blob)) throw new ProviderError(`The ${label} image is missing.`, 400);
  if (file.size > MAX_UPLOAD_BYTES) throw new ProviderError(`The ${label} image is larger than 15 MB.`, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const v = validateImageBytes(bytes.subarray(0, 256 * 1024), bytes.length);
  if (!v.ok) throw new ProviderError(`${label[0]!.toUpperCase()}${label.slice(1)} image: ${v.reason}`, 415);
  try {
    // Re-encode: strips metadata, bounds size, and proves the content really decodes.
    const out = await sharp(bytes, { limitInputPixels: 40_000_000, animated: false })
      .rotate()
      .resize({ width: MODEL_SIDE, height: MODEL_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 86 })
      .toBuffer();
    return { base64: out.toString("base64"), mime: "image/jpeg" };
  } catch {
    throw new ProviderError(`The ${label} image couldn't be decoded on the server.`, 415);
  }
}

export async function POST(req: Request) {
  const rejected = rejectUnsafeAiRequest(req);
  if (rejected) return rejected;
  const cfg = getProviderConfig();
  if (!cfg.configured) return NextResponse.json({ ok: false, error: cfg.reason, code: "not-configured" }, { status: 503 });

  // Three reference images up to 15 MB each plus a small JSON context. Reject larger bodies before parsing them.
  const cap = MAX_UPLOAD_BYTES * 3 + 256 * 1024;
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declared) || !Number.isInteger(declared) || declared <= 0 || declared > cap) {
    return NextResponse.json({ ok: false, error: "The request is missing a size or is larger than three 15 MB images." }, { status: 413 });
  }

  let form: FormData;
  try {
    const bytes = await readBodyBytes(req, cap);
    form = await new Request(req.url, {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") ?? "" },
      body: bytes,
    }).formData();
  } catch (error) {
    if (error instanceof BodyReadError) return NextResponse.json({ ok: false, error: error.status === 413 ? "The request is larger than three 15 MB images." : error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: "The request wasn't valid form data." }, { status: 400 });
  }

  try {
    let briefRaw: unknown, allowedRaw: unknown;
    try {
      const briefField = form.get("brief"), allowedField = form.get("allowed");
      briefRaw = typeof briefField === "string" ? JSON.parse(briefField) : null;
      allowedRaw = typeof allowedField === "string" ? JSON.parse(allowedField) : null;
    } catch {
      return NextResponse.json({ ok: false, error: "The brief or allowed choices were malformed." }, { status: 400 });
    }
    const brief = BriefSchema.safeParse(briefRaw), allowed = AllowedSchema.safeParse(allowedRaw);
    if (!brief.success || !allowed.success) return NextResponse.json({ ok: false, error: "The brief or allowed choices were malformed." }, { status: 400 });
    const references = form.getAll("reference");
    if (references.length < 1 || references.length > 3) return NextResponse.json({ ok: false, error: "Supply 1–3 reference images." }, { status: 400 });
    const images: PreparedImage[] = [];
    for (const file of references) images.push(await prepare(file, "reference"));
    const timeout = Math.min(120_000, Math.max(10_000, Number(process.env.AI_TIMEOUT_MS) || 60_000));
    const direction = await requestDirection(cfg.provider, images, { brief: brief.data, allowed: allowed.data }, timeout);
    return NextResponse.json({ ok: true, provider: cfg.provider.id, model: cfg.provider.model, direction });
  } catch (e) {
    const err = e instanceof ProviderError ? e : new ProviderError("The AI direction request failed unexpectedly.");
    const status =
      err.status && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 403 && err.status !== 404 && err.status !== 429
        ? err.status
        : 502;
    return NextResponse.json({ ok: false, error: err.message, provider: cfg.provider.id }, { status });
  }
}
