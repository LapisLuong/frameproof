import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_stamp",
  "name": "Stamp",
  "kind": "mark",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "circle",
      "name": "Circle",
      "role": "motif",
      "type": "shape",
      "shape": "ellipse",
      "x": 210,
      "y": 0,
      "w": 180,
      "h": 180,
      "fill": null,
      "stroke": "#202323",
      "strokeWidth": 3
    },
    {
      "id": "stamp",
      "name": "Stamp",
      "role": "info",
      "type": "text",
      "text": "Hà Nội",
      "x": 220,
      "y": 65,
      "w": 160,
      "h": 70,
      "size": 30,
      "font": "archivo",
      "color": "#202323",
      "align": "center"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
