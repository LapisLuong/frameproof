import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_grid",
  "name": "Grid",
  "kind": "info",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "rule",
      "name": "Rule",
      "role": "motif",
      "type": "shape",
      "shape": "rect",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 2,
      "fill": "#202323"
    },
    {
      "id": "left",
      "name": "Left",
      "role": "info",
      "type": "text",
      "text": "Ngày / 24.10",
      "x": 0,
      "y": 30,
      "w": 280,
      "h": 100,
      "size": 30,
      "font": "archivo",
      "color": "#202323"
    },
    {
      "id": "right",
      "name": "Right",
      "role": "info",
      "type": "text",
      "text": "Giờ / 20:00",
      "x": 320,
      "y": 30,
      "w": 280,
      "h": 100,
      "size": 30,
      "font": "archivo",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
