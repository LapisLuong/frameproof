import { TemplateSchema, OWN_LICENCE, type TemplateInput } from "../library";
export const template: TemplateInput = {
  "id": "tpl_editorial-image",
  "name": "Khoảng / 01",
  "concept": "editorial-cover",
  "idea": "A serif masthead frames one generous image aperture.",
  "width": 1080,
  "height": 1350,
  "background": "#f3eee5",
  "layers": [
    {
      "id": "masthead",
      "name": "Masthead",
      "type": "text",
      "text": "Khoảng",
      "x": 65,
      "y": 35,
      "w": 950,
      "h": 210,
      "size": 180,
      "font": "playfair-display",
      "color": "#302b45",
      "weight": 600
    },
    {
      "id": "aperture-ground",
      "name": "Aperture Ground",
      "type": "shape",
      "shape": "rect",
      "x": 65,
      "y": 280,
      "w": 950,
      "h": 770,
      "fill": "#b4b7a0"
    },
    {
      "id": "photo1",
      "name": "Photo slot 1",
      "type": "image",
      "resourceId": null,
      "x": 65,
      "y": 280,
      "w": 950,
      "h": 770
    },
    {
      "id": "cover-line",
      "name": "Cover Line",
      "type": "text",
      "text": "Những khoảng lặng của Hà Nội",
      "x": 65,
      "y": 1090,
      "w": 850,
      "h": 110,
      "size": 48,
      "font": "archivo",
      "color": "#302b45"
    },
    {
      "id": "folio",
      "name": "Folio",
      "type": "text",
      "text": "01 / Nghệ thuật & đời sống / Tháng Mười",
      "x": 65,
      "y": 1260,
      "w": 950,
      "h": 45,
      "size": 22,
      "font": "archivo",
      "color": "#302b45"
    }
  ]
, "licence": OWN_LICENCE };
TemplateSchema.parse(template);
