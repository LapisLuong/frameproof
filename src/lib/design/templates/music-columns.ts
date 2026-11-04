import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  id: "tpl_music-columns", name: "Nhịp / Đêm diễn", concept: "music",
  idea: "A narrow programme rail anchors an oversized two-line title and an off-centre record disc.",
  width: 1080, height: 1350, background: "#182d46", licence: OWN_LICENCE,
  layers: [
    { id: "rail", name: "Programme ground", role: "ground", type: "shape", shape: "rect", x: 0, y: 0, w: 250, h: 1350, fill: "#e9d58a" },
    { id: "record", name: "Rhythm disc", role: "motif", type: "shape", shape: "ellipse", x: 580, y: 730, w: 420, h: 420, fill: "#cf624d" },
    { id: "record-hole", name: "Disc centre", role: "motif", type: "shape", shape: "ellipse", x: 750, y: 900, w: 80, h: 80, fill: "#182d46" },
    { id: "title", name: "Title", role: "title", type: "text", text: "NHỊP\nĐÊM", x: 300, y: 120, w: 710, h: 550, size: 220, lineHeight: 1.05, font: "anton", color: "#f5eed8" },
    { id: "kicker", name: "Series", role: "kicker", type: "text", text: "Âm nhạc\nđương đại", x: 30, y: 80, w: 190, h: 130, size: 30, font: "archivo", weight: 600, color: "#182d46" },
    { id: "number", name: "Edition", role: "number", type: "text", text: "03", x: 30, y: 300, w: 190, h: 150, size: 100, font: "anton", color: "#182d46" },
    { id: "info", name: "Programme", role: "info", type: "text", text: "24.10.2026\n20:00\n\nNhà hát Lớn\nHà Nội", x: 30, y: 950, w: 195, h: 330, size: 27, font: "archivo", color: "#182d46" },
    { id: "subtitle", name: "Subtitle", role: "subtitle", type: "text", text: "Những thanh âm\ncủa thành phố", x: 300, y: 1170, w: 690, h: 130, size: 42, font: "fraunces", italic: true, color: "#f5eed8" },
  ],
};
TemplateSchema.parse(template);
