import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_photo-caption",
  "name": "Photo Caption",
  "kind": "frame",
  "width": 600,
  "height": 400,
  "layers": [
    {
      "id": "photo1",
      "name": "Photo slot 1",
      "type": "image",
      "resourceId": null,
      "x": 10,
      "y": 10,
      "w": 360,
      "h": 300,
      "radius": 180
    },
    {
      "id": "mask",
      "name": "Mask",
      "type": "shape",
      "shape": "rect",
      "x": 380,
      "y": 10,
      "w": 200,
      "h": 300,
      "fill": "#d2503d"
    },
    {
      "id": "caption",
      "name": "Caption",
      "type": "text",
      "text": "Ảnh / Ký ức",
      "x": 10,
      "y": 330,
      "w": 580,
      "h": 60,
      "size": 28,
      "font": "archivo",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
