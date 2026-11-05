import type { FontRef, LayerInput, LayerRole, EffectKind } from "../schema";

export const text = (id: string, role: LayerRole, copy: string, font: FontRef, size: number, color: string, x: number, y: number, w: number, h: number, weight = 400): LayerInput => ({
  id: id.toLowerCase().replaceAll(" ", "-"), name: id.replaceAll("-", " "), role, type: "text", text: copy, font, size, weight, color, x, y, w, h, lineHeight: 1.05,
});
export const photo = (id: string, x: number, y: number, w: number, h: number): LayerInput => ({
  id: id.toLowerCase().replaceAll(" ", "-"), name: id.replaceAll("-", " "), role: "photo", type: "image", resourceId: null, fit: "contain", x, y, w, h,
});
export const effect = (id: string, kind: EffectKind, color: string, x: number, y: number, w: number, h: number, intensity: number, spread: number, blur = 0): LayerInput => ({
  id: id.toLowerCase().replaceAll(" ", "-"), name: id.replaceAll("-", " "), role: "motif", type: "effect", effect: kind, color, x, y, w, h, intensity, spread, blur, seed: 37, curve: .35,
  blend: kind === "vignette" ? "multiply" : kind === "grain" ? "soft-light" : "screen",
});
