import { OWN_LICENCE, type TemplateInput } from "../library";
import { text, photo, effect } from "./style-helpers";

export const template: TemplateInput = {
  id: "tpl_spotlight", name: "Spotlight", concept: "music",
  idea: "A vertical shaft of light holds a central performer above a broad headline and precisely aligned programme details.",
  width: 1080, height: 1920, background: "#0c1c2e", licence: OWN_LICENCE,
  layers: [
    photo("Performer slot", 260, 320, 560, 740),
    { ...photo("Logo slot", 78, 76, 155, 100), role: "motif", name: "Logo slot" },
    effect("Warm halo", "glow", "#e6bd65", 170, 320, 740, 830, .32, .08, 35),
    effect("Overhead beam", "beam", "#3b7794", 210, 0, 660, 1070, .6, .65, 20),
    text("Title", "title", "Dạ hành\nkhúc", "fraunces", 148, "#f5efd9", 78, 1060, 924, 350, 800),
    text("Subtitle", "subtitle", "Đêm nhạc thính phòng", "archivo", 32, "#e6bd65", 80, 1470, 920, 65),
    text("Date and time", "info", "14 · 12 · 2026\n20:00", "archivo", 30, "#f5efd9", 80, 1660, 400, 150),
    text("Place", "info", "Nhà hát Lớn\nHà Nội", "archivo", 30, "#f5efd9", 580, 1660, 420, 150),
    effect("Stage sparkles", "sparkle", "#e6bd65", 340, 210, 400, 300, .7, .08),
  ],
};
