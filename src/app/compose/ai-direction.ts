"use client";

import { DirectionAnswerSchema, type Allowed, type DirectionAnswer } from "@/lib/ai/direction-schema";
import { withBase } from "@/lib/base-path";
import type { Brief } from "@/lib/design/direction";

export type AiDirectionResult = DirectionAnswer & { provider: string; model: string };

/**
 * Ask the server's vision model for an art direction. The references are sent only when the user presses the
 * button; the answer is validated again here (shape and allowed ids) before anything uses it.
 */
export async function requestAiDirection(input: { refs: Blob[]; brief: Brief; allowed: Allowed }): Promise<AiDirectionResult> {
  const form = new FormData();
  input.refs.slice(0, 3).forEach((r, i) => form.append("reference", r, `reference-${i + 1}`));
  form.append("brief", JSON.stringify(input.brief));
  form.append("allowed", JSON.stringify(input.allowed));
  let res: Response;
  try {
    res = await fetch(withBase("/api/direction"), { method: "POST", body: form });
  } catch {
    throw new Error("Couldn't reach the AI direction service.");
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; provider?: string; model?: string; direction?: unknown } | null;
  if (!body) throw new Error(res.status === 404 ? "AI direction isn't available on this build (static demo)." : `The server answered ${res.status} without details.`);
  if (!body.ok) throw new Error(body.error ?? "The AI direction failed.");
  const parsed = DirectionAnswerSchema.safeParse(body.direction);
  if (!parsed.success) throw new Error("The AI answer didn't match the direction format, so it wasn't used.");
  const a = parsed.data;
  const bad = [a.fonts.display, a.fonts.text].filter((f) => !input.allowed.fontIds.includes(f)).concat(a.concepts.map((c) => c.templateId).filter((t) => !input.allowed.templateIds.includes(t)));
  if (bad.length) throw new Error("The AI answer named fonts or templates that don't exist here, so it wasn't used.");
  return { ...a, provider: body.provider ?? "", model: body.model ?? "" };
}
