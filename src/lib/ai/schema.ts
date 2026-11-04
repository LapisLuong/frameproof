import { z } from "zod";
import { CATEGORIES, LEVELS, type ReviewIssue } from "../review/types";

/**
 * What the model may return. There is deliberately no "measurements" block:
 * a model cannot measure, so everything it says is an observation.
 */
export const AiObservationSchema = z.object({
  category: z.enum(CATEGORIES),
  title: z.string().min(3).max(120),
  observation: z.string().min(10).max(900),
  recommendation: z.string().min(10).max(900),
  rationale: z.string().min(10).max(900),
  preserve: z.string().max(500).default(""),
  priority: z.enum(LEVELS),
  confidence: z.enum(LEVELS),
});

export const AiReviewSchema = z.object({
  summary: z.string().min(10).max(800),
  observations: z.array(AiObservationSchema).max(8),
  /** What the model could not judge from the images (e.g. small text it couldn't read). */
  uncertainty: z.string().max(600).default(""),
});

export type AiReview = z.infer<typeof AiReviewSchema>;

/** Measured facts sent alongside the images. Small and explicit — never the raw pixels. */
export const MeasuredContextSchema = z.object({
  reference: z.object({ width: z.number(), height: z.number(), palette: z.array(z.object({ hex: z.string(), share: z.number() })).max(12) }),
  current: z.object({ width: z.number(), height: z.number(), palette: z.array(z.object({ hex: z.string(), share: z.number() })).max(12) }),
  localFindings: z.array(z.string().max(200)).max(20),
});
export type MeasuredContext = z.infer<typeof MeasuredContextSchema>;

export function toIssues(review: AiReview, reviewId: string): ReviewIssue[] {
  return review.observations.map((o, i) => ({
    ...o,
    id: `${reviewId}:ai-${i + 1}`,
    evidenceType: "ai-observed" as const,
    evidence: [],
    source: "ai" as const,
    resolved: false,
  }));
}

/** Pull the first JSON object out of a model reply (handles stray prose or code fences). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model reply contained no JSON object.");
  return JSON.parse(body.slice(start, end + 1));
}

export const SYSTEM_PROMPT = `You are a senior art director reviewing a work-in-progress design against a reference the designer wants to learn from.
You receive two images (first: REFERENCE, second: CURRENT), the designer's brief, and measurements computed by deterministic code.

Rules:
- You cannot measure. Do not state pixel sizes, ratios, colour values or percentages unless you are quoting the supplied measurements, and say so when you do.
- Do not repeat the local findings; add what only visual judgement can see: hierarchy, reading order, composition, typography, alignment, art-direction fit.
- Never name a specific typeface as fact. You may say "a geometric sans similar to…" and mark confidence low.
- Each observation must say what is wrong, why it matters, what to change, and what to keep.
- Use confidence "low" whenever small text, fine detail or intent is unclear.
- If the current design is already strong in an area, do not invent a problem. Fewer, better observations beat many weak ones.
- Reply with ONE JSON object and nothing else, matching:
{"summary": string, "observations": [{"category": "typography"|"layout"|"color"|"hierarchy"|"consistency"|"accessibility", "title": string, "observation": string, "recommendation": string, "rationale": string, "preserve": string, "priority": "high"|"medium"|"low", "confidence": "high"|"medium"|"low"}], "uncertainty": string}
Maximum 6 observations.`;

export function userPrompt(brief: string, ctx: MeasuredContext): string {
  return [
    `Designer's brief: ${brief.trim() || "(none given)"}`,
    "",
    "Measured by code (trust these numbers; do not contradict them):",
    JSON.stringify(ctx),
    "",
    "Image 1 is the REFERENCE. Image 2 is the CURRENT design. Return the JSON object now.",
  ].join("\n");
}
