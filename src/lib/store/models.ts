import type { ImageAnalysis, StoredComparison } from "../analysis/analyze";
import type { ReviewIssue } from "../review/types";

export type Asset = {
  id: string;
  projectId: string | null;
  name: string;
  /** Sniffed MIME type, not the browser-declared one. */
  type: string;
  bytes: number;
  width: number;
  height: number;
  blob: Blob;
  thumb: Blob;
  analysis: ImageAnalysis;
  createdAt: number;
  /** Shipped with the app as an example; never presented as the user's own work. */
  sample?: boolean;
};

export type Project = {
  id: string;
  name: string;
  brief: string;
  referenceAssetId: string | null;
  currentAssetId: string | null;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  sample?: boolean;
};

export type AiStatus =
  | { state: "not-configured" }
  | { state: "skipped" }
  | { state: "ok"; provider: string; model: string; summary: string }
  | { state: "failed"; provider: string; message: string };

export type Review = {
  id: string;
  projectId: string;
  /** 1-based version number within the project. */
  version: number;
  createdAt: number;
  referenceAssetId: string;
  currentAssetId: string;
  measurements: { reference: ImageAnalysis; current: ImageAnalysis; comparison: StoredComparison };
  issues: ReviewIssue[];
  ai: AiStatus;
  notes: string;
};

export const REFERENCE_CATEGORIES = ["Typography", "Layout", "Color", "Motion", "Editorial", "Branding", "Web", "Presentation"] as const;
export type ReferenceCategory = (typeof REFERENCE_CATEGORIES)[number];

export type InspirationRef = {
  id: string;
  title: string;
  /** Link to the original. FrameProof never scrapes or copies the page. */
  url: string;
  /** Who made it / where it came from, as the user records it. */
  attribution: string;
  assetId: string | null;
  tags: string[];
  category: ReferenceCategory;
  collection: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type StyleToken = { name: string; value: string; note?: string };

export type StyleSystem = {
  id: string;
  name: string;
  palette: Array<{ name: string; hex: string; share?: number; origin: "measured" | "manual" }>;
  typography: { display: string; body: string; mono: string; notes: string };
  layoutPrinciples: string[];
  spacing: StyleToken[];
  radius: StyleToken[];
  motion: string[];
  referenceIds: string[];
  /** Asset the palette was measured from, if any. */
  sourceAssetId: string | null;
  notes: string;
  createdAt: number;
  updatedAt: number;
};
