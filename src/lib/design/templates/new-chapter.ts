import { OWN_LICENCE, type TemplateInput } from "../library";
import { text, photo, effect } from "./style-helpers";

export const template: TemplateInput = {
  id: "tpl_new-chapter", name: "New chapter", concept: "exhibition",
  idea: "A weighty serif heading anchors a pair of book cutouts, with a script initial and a fine trail connecting them.",
  width: 1080, height: 1350, background: "#183b30", licence: OWN_LICENCE,
  layers: [
    photo("Book slot", 130, 490, 380, 495),
    photo("Card slot", 590, 580, 340, 400),
    effect("Connecting trail", "trail", "#bd9664", 70, 750, 940, 300, .65, .12, 2),
    effect("Paper grain", "grain", "#81b48c", 0, 0, 1080, 1350, .09, .18),
    effect("Edge vignette", "vignette", "#10271f", 0, 0, 1080, 1350, .35, .3),
    text("Initial swash", "motif", "C", "great-vibes", 240, "#81b48c", 820, 290, 210, 280),
    text("Title", "title", "Chương\nmới", "cormorant-garamond", 158, "#f2efd1", 110, 80, 860, 360, 700),
    text("Subtitle", "subtitle", "Triển lãm sách nghệ sĩ", "archivo", 28, "#bd9664", 130, 430, 800, 50),
    text("Date", "info", "14–28 · 12 · 2026\n09:00–18:00", "archivo", 25, "#f2efd1", 130, 1110, 380, 130),
    text("Place", "info", "Không gian sách\nHà Nội", "archivo", 25, "#f2efd1", 590, 1110, 360, 130),
    effect("Paper sparkles", "sparkle", "#f2efd1", 400, 510, 550, 490, .65, .08),
  ],
};
