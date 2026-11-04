import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  "id": "tpl_exhibition",
  "name": "Triển lãm / Vòng",
  "concept": "exhibition",
  "idea": "A cropped title and four circles create a measured visual beat.",
  "width": 1200,
  "height": 1800,
  "background": "#eee8d8",
  "layers": [
    {
      "id": "title",
      "name": "Title (cropped)",
      "type": "text",
      "text": "VÒNG",
      "x": -45,
      "y": 110,
      "w": 1400,
      "h": 510,
      "size": 480,
      "font": "anton",
      "color": "#173b34"
    },
    {
      "id": "circle-0",
      "name": "Circle 0",
      "type": "shape",
      "shape": "ellipse",
      "x": 80,
      "y": 780,
      "w": 230,
      "h": 230,
      "fill": "#d65b35"
    },
    {
      "id": "circle-1",
      "name": "Circle 1",
      "type": "shape",
      "shape": "ellipse",
      "x": 350,
      "y": 780,
      "w": 230,
      "h": 230,
      "fill": "#d65b35"
    },
    {
      "id": "circle-2",
      "name": "Circle 2",
      "type": "shape",
      "shape": "ellipse",
      "x": 620,
      "y": 780,
      "w": 230,
      "h": 230,
      "fill": "#d65b35"
    },
    {
      "id": "circle-3",
      "name": "Circle 3",
      "type": "shape",
      "shape": "ellipse",
      "x": 890,
      "y": 780,
      "w": 230,
      "h": 230,
      "fill": "#d65b35"
    },
    {
      "id": "subtitle",
      "name": "Subtitle",
      "type": "text",
      "text": "Triển lãm những chuyển động",
      "x": 80,
      "y": 1180,
      "w": 1040,
      "h": 150,
      "size": 58,
      "font": "anton",
      "color": "#173b34"
    },
    {
      "id": "info-rule",
      "name": "Info Rule",
      "type": "shape",
      "shape": "rect",
      "x": 80,
      "y": 1510,
      "w": 1040,
      "h": 2,
      "fill": "#173b34"
    },
    {
      "id": "dates",
      "name": "Dates",
      "type": "text",
      "text": "12–30 / Tháng Mười / 2026",
      "x": 80,
      "y": 1538,
      "w": 500,
      "h": 90,
      "size": 26,
      "font": "archivo",
      "color": "#173b34"
    },
    {
      "id": "venue",
      "name": "Venue",
      "type": "text",
      "text": "Bảo tàng Hà Nội\n09:00–18:00 · Thiết kế: Studio",
      "x": 650,
      "y": 1538,
      "w": 470,
      "h": 120,
      "size": 24,
      "font": "archivo",
      "color": "#173b34"
    }
  ]
, "licence": OWN_LICENCE };
TemplateSchema.parse(template);
