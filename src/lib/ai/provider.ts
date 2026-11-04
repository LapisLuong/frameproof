// Server-only: imported exclusively by src/app/api/review/route.ts. Never import from client code.
import { AiReviewSchema, extractJson, SYSTEM_PROMPT, userPrompt, type AiReview, type MeasuredContext } from "./schema";

export type PreparedImage = { base64: string; mime: "image/jpeg" | "image/png" };

export interface VisionProvider {
  readonly id: "anthropic" | "openai";
  readonly model: string;
  /** Returns raw text from the model. Callers supply 1–4 prepared images (review keeps its fixed pair). */
  complete(system: string, user: string, images: PreparedImage[], signal: AbortSignal): Promise<string>;
}

export type ProviderConfig = { configured: false; reason: string } | { configured: true; provider: VisionProvider };

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new ProviderError("The model took too long to answer.", undefined, true);
    throw new ProviderError("Couldn't reach the AI provider. Check the network and the base URL.", undefined, true);
  }
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    const hint =
      res.status === 401 || res.status === 403
        ? "The API key was rejected."
        : res.status === 404
          ? "The model id wasn't found for this key."
          : res.status === 429
            ? "The provider is rate-limiting requests."
            : `The provider answered ${res.status}.`;
    throw new ProviderError(hint, res.status, retryable);
  }
  return res.json();
}

class AnthropicProvider implements VisionProvider {
  readonly id = "anthropic" as const;
  constructor(
    private key: string,
    readonly model: string,
  ) {}
  async complete(system: string, user: string, images: PreparedImage[], signal: AbortSignal) {
    const data = (await postJson(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.key, "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        max_tokens: 2500,
        system,
        messages: [
          {
            role: "user",
            content: [
              ...images.flatMap((image, i) => [
                { type: "text", text: images.length === 2 ? (i === 0 ? "Image 1 — REFERENCE" : "Image 2 — CURRENT") : `Image ${i + 1}` },
                { type: "image", source: { type: "base64", media_type: image.mime, data: image.base64 } },
              ]),
              { type: "text", text: user },
            ],
          },
        ],
      },
      signal,
    )) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    if (!text) throw new ProviderError("The model returned an empty answer.", undefined, true);
    return text;
  }
}

class OpenAICompatibleProvider implements VisionProvider {
  readonly id = "openai" as const;
  constructor(
    private key: string,
    readonly model: string,
    private baseUrl: string,
  ) {}
  async complete(system: string, user: string, images: PreparedImage[], signal: AbortSignal) {
    const data = (await postJson(
      `${this.baseUrl.replace(/\/$/, "")}/chat/completions`,
      { authorization: `Bearer ${this.key}` },
      {
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              ...images.flatMap((image, i) => [
                { type: "text", text: images.length === 2 ? (i === 0 ? "Image 1 — REFERENCE" : "Image 2 — CURRENT") : `Image ${i + 1}` },
                { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } },
              ]),
              { type: "text", text: user },
            ],
          },
        ],
      },
      signal,
    )) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError("The model returned an empty answer.", undefined, true);
    return text;
  }
}

export function getProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const name = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (!name) return { configured: false, reason: "AI review is off. Set AI_PROVIDER and an API key in .env.local to turn it on." };
  if (name === "anthropic") {
    const key = env.ANTHROPIC_API_KEY?.trim();
    if (!key) return { configured: false, reason: "AI_PROVIDER is anthropic but ANTHROPIC_API_KEY is empty." };
    return { configured: true, provider: new AnthropicProvider(key, env.AI_MODEL?.trim() || "claude-sonnet-5-5") };
  }
  if (name === "openai") {
    const key = env.OPENAI_API_KEY?.trim();
    const model = env.AI_MODEL?.trim();
    if (!key) return { configured: false, reason: "AI_PROVIDER is openai but OPENAI_API_KEY is empty." };
    if (!model) return { configured: false, reason: "AI_PROVIDER is openai but AI_MODEL is empty. Set it to a vision-capable model id." };
    return { configured: true, provider: new OpenAICompatibleProvider(key, model, env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1") };
  }
  return { configured: false, reason: `AI_PROVIDER "${name}" isn't supported. Use anthropic or openai.` };
}

/**
 * Ask for a review, validate it strictly, retry once on a transient failure or invalid output.
 * Never returns partial or invented content: it either returns a schema-valid review or throws.
 */
export async function requestReview(
  provider: VisionProvider,
  images: [PreparedImage, PreparedImage],
  brief: string,
  ctx: MeasuredContext,
  timeoutMs: number,
): Promise<AiReview> {
  let lastError: Error = new Error("Unknown error");
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await provider.complete(SYSTEM_PROMPT, userPrompt(brief, ctx), images, controller.signal);
      const parsed = AiReviewSchema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = new ProviderError("The model's answer didn't match the review format.", undefined, true);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (e instanceof SyntaxError) lastError = new ProviderError("The model's answer wasn't valid JSON.", undefined, true);
      if (lastError instanceof ProviderError && !lastError.retryable) throw lastError;
    } finally {
      clearTimeout(timer);
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 800));
  }
  throw lastError;
}
