import { BUILTIN_FONTS, type BuiltinFontId } from "../design/fonts";
import type { StyleSystem } from "../store/models";

export type StylePreset = {
  id: string; name: string; category: string; specimen: string; description: string;
  colours: readonly [string, string, string, string];
  display: BuiltinFontId; body: BuiltinFontId; principles: string[]; source: string;
};

/** Original art-direction recipes. References are inspiration links, never redistributed third-party templates. */
export const STYLE_PRESETS: StylePreset[] = [
  { id: "lyrical-night", name: "Dạ khúc", category: "Artistic cover", specimen: "Dạ hành khúc", description: "Thin, lyrical serif with space for a separate swash and a quiet light trail.", colours: ["#101d54", "#eee9fb", "#a2b9e2", "#716b9a"], display: "cormorant-garamond", body: "be-vietnam-pro", principles: ["Use an asymmetric three-line title; keep the subject's important details clear.", "Let one decorative initial or vector swash lead; keep information plain.", "Place restrained light and sparkle effects on separate editable layers."], source: "https://www.pinterest.com/pin/666955026084217340/" },
  { id: "emerald-magic", name: "Chương mới", category: "Artistic cover", specimen: "Chương mới", description: "Emerald ground, ivory serif and warm brass details for a magical editorial poster.", colours: ["#183b30", "#f2efd1", "#81b48c", "#bd9664"], display: "cormorant-garamond", body: "archivo", principles: ["Set a generous serif title above a collage of supplied cut-out items.", "Use warm brass for secondary information and ivory for the main title.", "Keep grain, glow and light trails independently adjustable."], source: "https://land-book.com/" },
  { id: "cinematic-spotlight", name: "Ánh sân khấu", category: "Event", specimen: "Khoảnh khắc", description: "Midnight navy and amber light, with a strong focal image and a disciplined footer.", colours: ["#0b1a29", "#f3e8c8", "#d4a558", "#4f7891"], display: "playfair-display", body: "barlow-condensed", principles: ["Reserve a central image zone beneath a narrow shaft of light.", "Keep title and date in distinct bands rather than overlapping every element.", "Use the amber accent sparingly to guide the reading order."], source: "https://www.pinterest.com/pin/1129699887792088843/" },
  { id: "editorial-ivory", name: "Khoảng", category: "Editorial", specimen: "Khoảng lặng", description: "Paper, ink and a single red accent for quiet book covers and exhibitions.", colours: ["#f2ecdf", "#252a2b", "#b84b3f", "#a6a391"], display: "lora", body: "be-vietnam-pro", principles: ["Align the title, image and caption to a shared margin.", "Keep generous unoccupied space around the focal artwork.", "Use one accent rule or small mark; let typography carry the hierarchy."], source: "https://land-book.com/" },
  { id: "swiss-signal", name: "Tín hiệu", category: "Typography", specimen: "TÍN HIỆU", description: "Condensed type, sharp alignment and a clear signal colour for cultural events.", colours: ["#f0eee7", "#17242b", "#e4572e", "#a8bdc7"], display: "anton", body: "archivo", principles: ["Build the headline on a visible alignment grid.", "Use scale contrast between headline and practical information.", "Repeat one geometric motif instead of adding unrelated decoration."], source: "https://collectui.com/" },
  { id: "paper-collage", name: "Mảnh ký ức", category: "Collage", specimen: "Mảnh ký ức", description: "Muted paper colours, layered photographs and expressive italic titles.", colours: ["#d8d5c6", "#253c38", "#c66a52", "#b7c8c3"], display: "fraunces", body: "space-grotesk", principles: ["Overlap two or three supplied images with deliberate changes of scale.", "Keep caption strips and paper shapes as independent layers.", "Protect one clean text area so the collage remains readable."], source: "https://www.pinterest.com/search/pins/?q=editorial%20collage%20poster" },
  { id: "botanical-archive", name: "Vườn lưu trữ", category: "Botanical", specimen: "Vườn ký ức", description: "Botanical specimens, forest ink and a delicate serif for art-book compositions.", colours: ["#eee9d7", "#254536", "#9e784d", "#a4b59a"], display: "cormorant-garamond", body: "be-vietnam-pro", principles: ["Use a real botanical image with clear provenance as the main subject.", "Pair a delicate title with small, aligned archival captions.", "Limit ornaments to thin rules or a single corner flourish."], source: "https://www.metmuseum.org/art/collection/search/360446" },
  { id: "warm-print", name: "Bản in chiều", category: "Editorial", specimen: "Một chiều nắng", description: "Ochre, terracotta and dark brown with a warm display serif for print-inspired work.", colours: ["#f1d99d", "#3f2d25", "#ba5d3e", "#c7b390"], display: "fraunces", body: "archivo", principles: ["Use a compact headline block balanced by an image or bold shape.", "Keep a consistent warm ground across campaign variants.", "Use texture lightly and preserve sharp information text."], source: "https://land-book.com/" },
];

export function styleFromPreset(preset: StylePreset, id: string, now = Date.now()): StyleSystem {
  return {
    id, name: preset.name,
    palette: preset.colours.map((hex, i) => ({ name: ["Ground", "Ink", "Accent", "Support"][i]!, hex, origin: "manual" })),
    typography: { display: BUILTIN_FONTS[preset.display].label, body: BUILTIN_FONTS[preset.body].label, mono: "IBM Plex Mono", notes: "Built-in, self-hosted OFL fonts with Vietnamese and English support. These are curated choices, not measured font matches." },
    layoutPrinciples: [...preset.principles], spacing: [{ name: "Base", value: "8px" }], radius: [{ name: "Artwork corner", value: "0px" }],
    motion: ["Use short transitions for controls; respect reduced motion. Keep artwork still while editing."], referenceIds: [], sourceAssetId: null,
    notes: `Original FrameProof art-direction recipe. Inspiration only: ${preset.source}. No third-party artwork or template is copied into this style.`, createdAt: now, updatedAt: now,
  };
}
