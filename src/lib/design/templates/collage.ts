import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  "id": "tpl_collage",
  "name": "Mảnh / Ký ức",
  "concept": "collage",
  "idea": "Overlapping empty photographs meet a large italic focal word.",
  "width": 1080,
  "height": 1350,
  "background": "#c6d4d3",
  "layers": [
    {
      "id": "focal-disc",
      "name": "Focal Disc",
      "type": "shape",
      "shape": "ellipse",
      "x": 430,
      "y": 120,
      "w": 540,
      "h": 540,
      "fill": "#d2503d"
    },
    {
      "id": "photo1",
      "name": "Photo slot 1",
      "type": "image",
      "resourceId": null,
      "x": 100,
      "y": 170,
      "w": 440,
      "h": 550,
      "rotation": -6
    },
    {
      "id": "photo2",
      "name": "Photo slot 2",
      "type": "image",
      "resourceId": null,
      "x": 510,
      "y": 340,
      "w": 430,
      "h": 510,
      "rotation": 7
    },
    {
      "id": "paper-strip",
      "name": "Paper Strip",
      "type": "shape",
      "shape": "rect",
      "x": 70,
      "y": 750,
      "w": 940,
      "h": 110,
      "fill": "#eee7d5",
      "rotation": -3
    },
    {
      "id": "photo3",
      "name": "Photo slot 3",
      "type": "image",
      "resourceId": null,
      "x": 210,
      "y": 850,
      "w": 330,
      "h": 300,
      "rotation": -4
    },
    {
      "id": "title",
      "name": "Title",
      "type": "text",
      "text": "Mảnh",
      "x": 80,
      "y": 600,
      "w": 920,
      "h": 240,
      "size": 200,
      "font": "fraunces",
      "color": "#233b41",
      "italic": true,
      "weight": 600
    },
    {
      "id": "subtitle",
      "name": "Subtitle",
      "type": "text",
      "text": "Ký ức của thành phố",
      "x": 580,
      "y": 960,
      "w": 430,
      "h": 130,
      "size": 44,
      "font": "be-vietnam-pro",
      "color": "#233b41"
    },
    {
      "id": "details",
      "name": "Details",
      "type": "text",
      "text": "Ngày hội văn hoá / Hà Nội\n18–20 Tháng Mười · 2026",
      "x": 80,
      "y": 1210,
      "w": 930,
      "h": 100,
      "size": 26,
      "font": "be-vietnam-pro",
      "color": "#233b41"
    }
  ]
, "licence": OWN_LICENCE };
TemplateSchema.parse(template);
