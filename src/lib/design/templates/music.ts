import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  "id": "tpl_music",
  "name": "Đêm / Nhịp",
  "concept": "music",
  "idea": "Repeated rotated words build rhythm above a metadata strip.",
  "width": 1080,
  "height": 1920,
  "background": "#efd449",
  "layers": [
    {
      "id": "contrast-disc",
      "name": "Contrast Disc",
      "role": "motif",
      "type": "shape",
      "shape": "ellipse",
      "x": 650,
      "y": 190,
      "w": 350,
      "h": 350,
      "fill": "#e75937"
    },
    {
      "id": "title",
      "name": "Title",
      "role": "title",
      "type": "text",
      "text": "ĐÊM",
      "x": 70,
      "y": 80,
      "w": 930,
      "h": 330,
      "size": 290,
      "font": "anton",
      "color": "#202738"
    },
    {
      "id": "band-one",
      "name": "Band One",
      "role": "body",
      "type": "text",
      "text": "NHỊP / NHỊP",
      "x": 70,
      "y": 510,
      "w": 940,
      "h": 190,
      "size": 140,
      "font": "anton",
      "color": "#202738",
      "rotation": -7
    },
    {
      "id": "band-two",
      "name": "Band Two",
      "role": "body",
      "type": "text",
      "text": "ÂM NHẠC",
      "x": 70,
      "y": 800,
      "w": 940,
      "h": 200,
      "size": 150,
      "font": "anton",
      "color": "#202738"
    },
    {
      "id": "band-three",
      "name": "Band Three",
      "role": "body",
      "type": "text",
      "text": "MÂY / SÓNG",
      "x": 70,
      "y": 1090,
      "w": 940,
      "h": 160,
      "size": 125,
      "font": "anton",
      "color": "#202738",
      "rotation": 5
    },
    {
      "id": "strip",
      "name": "Strip",
      "role": "motif",
      "type": "shape",
      "shape": "rect",
      "x": 60,
      "y": 1580,
      "w": 960,
      "h": 240,
      "fill": "#202738"
    },
    {
      "id": "metadata",
      "name": "Metadata",
      "role": "info",
      "type": "text",
      "text": "24.10.2026 / 20:00\nNhà hát Lớn / Hà Nội",
      "x": 95,
      "y": 1620,
      "w": 890,
      "h": 160,
      "size": 38,
      "font": "archivo",
      "color": "#efd449"
    }
  ]
, "licence": OWN_LICENCE };
TemplateSchema.parse(template);
