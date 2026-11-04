import { OWN_LICENCE, type TemplateInput } from "../library";
import { ORNAMENT_PATHS } from "../items/ornaments";
import { text, photo, effect } from "./style-helpers";

export const template: TemplateInput = {
  id: "tpl_lyrical-night", name: "Lyrical night", concept: "editorial-cover",
  idea: "A stepped lyrical title occupies the left margin while a portrait keeps a quiet focal area on the right.",
  width: 1080, height: 1350, background: "#101d54", licence: OWN_LICENCE,
  layers: [
    photo("Portrait slot", 590, 410, 410, 650),
    effect("Soft glow", "glow", "#716b9a", 410, 350, 630, 760, .38, .15, 32),
    text("Title", "title", "Dạ\nhành", "cormorant-garamond", 152, "#eee9fb", 72, 140, 500, 370, 300),
    text("Closing word", "subtitle", "khúc", "cormorant-garamond", 206, "#eee9fb", 100, 520, 470, 260, 400),
    text("Ornamental word", "kicker", "Mộng", "great-vibes", 102, "#a2b9e2", 90, 820, 440, 155),
    { id: "swash", name: "Tapered swash", role: "motif", type: "shape", shape: "path", path: ORNAMENT_PATHS["swash-long"], fill: "#a2b9e2", x: 72, y: 985, w: 480, h: 70 },
    text("Issue note", "credit", "Tạp chí văn chương · Số mùa đông", "be-vietnam-pro", 22, "#a2b9e2", 72, 65, 900, 40),
    text("Information", "info", "Thơ và những cuộc đi trong đêm\nTháng 12 · 2026 · Hà Nội", "be-vietnam-pro", 25, "#eee9fb", 72, 1145, 900, 115),
    effect("Night sparkles", "sparkle", "#eee9fb", 630, 95, 340, 260, .75, .12),
  ],
};
