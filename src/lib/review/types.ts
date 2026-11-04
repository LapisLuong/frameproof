import { z } from "zod";

export const CATEGORIES = ["typography", "layout", "color", "hierarchy", "consistency", "accessibility"] as const;
export const LEVELS = ["high", "medium", "low"] as const;
export const EVIDENCE = ["measured", "estimated", "ai-observed"] as const;

export const ReviewIssueSchema = z.object({
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  title: z.string().min(1).max(140),
  /** What is wrong, in terms of what was seen or measured. */
  observation: z.string().min(1).max(1200),
  /** What to change. */
  recommendation: z.string().min(1).max(1200),
  /** Why it matters. */
  rationale: z.string().min(1).max(1200),
  /** What to keep while changing it. */
  preserve: z.string().max(600).default(""),
  priority: z.enum(LEVELS),
  confidence: z.enum(LEVELS),
  evidenceType: z.enum(EVIDENCE),
  /** Numbers that back the finding, shown in mono. */
  evidence: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  source: z.enum(["local", "ai"]),
  resolved: z.boolean(),
});

export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;
export type Category = (typeof CATEGORIES)[number];
export type Level = (typeof LEVELS)[number];
export type EvidenceType = (typeof EVIDENCE)[number];

export const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  measured: "Measured",
  estimated: "Estimated",
  "ai-observed": "AI-observed",
};

export const EVIDENCE_HELP: Record<EvidenceType, string> = {
  measured: "Computed from the pixels with a stated method. Reproducible.",
  estimated: "Computed from the pixels, but the interpretation relies on an assumption.",
  "ai-observed": "A vision model's judgement. Treat as a second opinion, not a fact.",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  typography: "Typography",
  layout: "Layout",
  color: "Colour",
  hierarchy: "Hierarchy",
  consistency: "Consistency",
  accessibility: "Accessibility",
};

const RANK: Record<Level, number> = { high: 0, medium: 1, low: 2 };

/** Priority first, then confidence, then measured before estimated before AI. Stable for equal keys. */
export function sortIssues(issues: ReviewIssue[]): ReviewIssue[] {
  const ev: Record<EvidenceType, number> = { measured: 0, estimated: 1, "ai-observed": 2 };
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort(
      (a, b) =>
        RANK[a.issue.priority] - RANK[b.issue.priority] ||
        RANK[a.issue.confidence] - RANK[b.issue.confidence] ||
        ev[a.issue.evidenceType] - ev[b.issue.evidenceType] ||
        a.i - b.i,
    )
    .map((x) => x.issue);
}
