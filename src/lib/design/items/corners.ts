import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_corners",
  "name": "Corners",
  "kind": "frame",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "top",
      "name": "Top",
      "type": "shape",
      "shape": "rect",
      "x": 0,
      "y": 0,
      "w": 70,
      "h": 4,
      "fill": "#202323"
    },
    {
      "id": "left",
      "name": "Left",
      "type": "shape",
      "shape": "rect",
      "x": 0,
      "y": 0,
      "w": 4,
      "h": 70,
      "fill": "#202323"
    },
    {
      "id": "bottom",
      "name": "Bottom",
      "type": "shape",
      "shape": "rect",
      "x": 530,
      "y": 176,
      "w": 70,
      "h": 4,
      "fill": "#202323"
    },
    {
      "id": "right",
      "name": "Right",
      "type": "shape",
      "shape": "rect",
      "x": 596,
      "y": 110,
      "w": 4,
      "h": 70,
      "fill": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
