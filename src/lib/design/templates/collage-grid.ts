import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  id: "tpl_collage-grid", name: "Dấu / Chuyện phố", concept: "collage",
  idea: "A measured three-aperture archive replaces overlapping scraps with an asymmetric photographic grid.",
  width: 1080, height: 1350, background: "#f0e6db", licence: OWN_LICENCE,
  layers: [
    { id: "side-rule", name: "Archive rule", role: "motif", type: "shape", shape: "rect", x: 60, y: 60, w: 8, h: 1230, fill: "#7c353e" },
    { id: "title", name: "Title", role: "title", type: "text", text: "Dấu phố", x: 110, y: 60, w: 860, h: 210, size: 145, font: "playfair-display", weight: 600, color: "#302e38" },
    { id: "subtitle", name: "Subtitle", role: "subtitle", type: "text", text: "Chuyện kể từ những ô cửa", x: 115, y: 280, w: 850, h: 80, size: 36, font: "archivo", color: "#7c353e" },
    { id: "photo1", name: "Main photo", role: "photo", type: "image", resourceId: null, x: 110, y: 410, w: 540, h: 660 },
    { id: "photo2", name: "Detail photo", role: "photo", type: "image", resourceId: null, x: 680, y: 410, w: 290, h: 300 },
    { id: "photo3", name: "Street photo", role: "photo", type: "image", resourceId: null, x: 680, y: 740, w: 290, h: 330 },
    { id: "caption", name: "Archive caption", role: "credit", type: "text", text: "Tư liệu của người dân / Hà Nội", x: 110, y: 1100, w: 860, h: 65, size: 25, font: "archivo", color: "#302e38" },
    { id: "info", name: "Exhibition information", role: "info", type: "text", text: "Triển lãm ảnh · 18–28.11.2026\nKhông gian văn hoá / 10:00–18:00", x: 110, y: 1200, w: 860, h: 110, size: 29, font: "archivo", color: "#302e38" },
  ],
};
TemplateSchema.parse(template);
