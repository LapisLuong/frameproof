import type { BlendMode, EffectKind, Layer } from "./schema";

/** Plain names for layer kinds, shared by the layer list and the inspector. */
export const SHAPE_LABEL = { line: "Rule", rect: "Rectangle", ellipse: "Ellipse", path: "Ornament" } as const;
export const EFFECT_LABEL: Record<EffectKind, string> = { glow: "Glow", beam: "Light beam", trail: "Light trail", sparkle: "Sparkles", grain: "Grain", vignette: "Vignette" };
export const BLEND_LABEL: Record<BlendMode, string> = { normal: "Normal", screen: "Screen (lightens)", lighten: "Lighten", multiply: "Multiply (darkens)", overlay: "Overlay", "soft-light": "Soft light" };
/** What "spread" means for each effect, so the control says what it does. */
export const SPREAD_LABEL: Record<EffectKind, string> = { glow: "Core size", beam: "Widening", trail: "Width", sparkle: "Amount", grain: "Coarseness", vignette: "Reach" };

export const layerKind = (l: Layer): string =>
  l.type === "text" ? "Text" : l.type === "image" ? (l.resourceId ? "Image" : "Image slot") : l.type === "effect" ? EFFECT_LABEL[l.effect] : SHAPE_LABEL[l.shape];
