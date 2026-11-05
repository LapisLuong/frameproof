import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  "id": "tpl_exhibition-type",
  "name": "Chữ / Tháng Mười",
  "concept": "type-as-image",
  "idea": "A single monumental Vietnamese character becomes the picture.",
  "width": 1200,
  "height": 1800,
  "background": "#2634a0",
  "layers": [
    {
      "id": "title",
      "name": "Title",
      "role": "title",
      "type": "text",
      "text": "Ơ",
      "x": 100,
      "y": 180,
      "w": 1000,
      "h": 1050,
      "size": 950,
      "font": "archivo",
      "color": "#efe7cd",
      "weight": 900,
      "align": "center"
    },
    {
      "id": "subtitle",
      "name": "Subtitle",
      "role": "subtitle",
      "type": "text",
      "text": "Chữ là hình ảnh",
      "x": 80,
      "y": 1270,
      "w": 1040,
      "h": 120,
      "size": 66,
      "font": "archivo",
      "color": "#efe7cd",
      "weight": 900
    },
    {
      "id": "info-rule",
      "name": "Info Rule",
      "role": "motif",
      "type": "shape",
      "shape": "rect",
      "x": 80,
      "y": 1510,
      "w": 1040,
      "h": 2,
      "fill": "#efe7cd"
    },
    {
      "id": "dates",
      "name": "Dates",
      "role": "info",
      "type": "text",
      "text": "12–30 / Tháng Mười / 2026",
      "x": 80,
      "y": 1538,
      "w": 500,
      "h": 90,
      "size": 26,
      "font": "archivo",
      "color": "#efe7cd"
    },
    {
      "id": "venue",
      "name": "Venue",
      "role": "info",
      "type": "text",
      "text": "Bảo tàng Hà Nội\n09:00–18:00 · Thiết kế: Studio",
      "x": 650,
      "y": 1538,
      "w": 470,
      "h": 120,
      "size": 24,
      "font": "archivo",
      "color": "#efe7cd"
    }
  ]
, "licence": OWN_LICENCE };
TemplateSchema.parse(template);
