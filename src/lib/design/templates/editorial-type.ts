import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  "id": "tpl_editorial-type",
  "name": "Nếp / 02",
  "concept": "editorial-cover",
  "idea": "Roman and italic voices share a quiet ruled cover.",
  "width": 1080,
  "height": 1350,
  "background": "#e1c7cf",
  "layers": [
    {
      "id": "top-rule",
      "name": "Top Rule",
      "role": "motif",
      "type": "shape",
      "shape": "rect",
      "x": 70,
      "y": 80,
      "w": 940,
      "h": 4,
      "fill": "#512f42"
    },
    {
      "id": "folio",
      "name": "Folio",
      "role": "number",
      "type": "text",
      "text": "Nếp / Tập 02 / Hà Nội",
      "x": 70,
      "y": 110,
      "w": 940,
      "h": 60,
      "size": 26,
      "font": "archivo",
      "color": "#512f42"
    },
    {
      "id": "headline",
      "name": "Headline",
      "role": "title",
      "type": "text",
      "text": "Điều\ncòn lại",
      "x": 70,
      "y": 280,
      "w": 940,
      "h": 560,
      "size": 190,
      "font": "fraunces",
      "color": "#512f42",
      "weight": 500,
      "lineHeight": 1.1
    },
    {
      "id": "contrast",
      "name": "Contrast",
      "role": "subtitle",
      "type": "text",
      "text": "sau một mùa",
      "x": 90,
      "y": 890,
      "w": 900,
      "h": 170,
      "size": 100,
      "font": "fraunces",
      "color": "#512f42",
      "italic": true
    },
    {
      "id": "bottom-rule",
      "name": "Bottom Rule",
      "role": "motif",
      "type": "shape",
      "shape": "rect",
      "x": 70,
      "y": 1160,
      "w": 940,
      "h": 4,
      "fill": "#512f42"
    },
    {
      "id": "details",
      "name": "Details",
      "role": "info",
      "type": "text",
      "text": "Văn hoá thị giác / Tháng Mười 2026",
      "x": 70,
      "y": 1210,
      "w": 940,
      "h": 70,
      "size": 26,
      "font": "archivo",
      "color": "#512f42"
    }
  ]
, "licence": OWN_LICENCE };
TemplateSchema.parse(template);
