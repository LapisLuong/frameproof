import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_arrow",
  "name": "Arrow",
  "kind": "mark",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "shaft",
      "name": "Shaft",
      "type": "shape",
      "shape": "rect",
      "x": 30,
      "y": 85,
      "w": 450,
      "h": 12,
      "fill": "#202323"
    },
    {
      "id": "upper",
      "name": "Upper",
      "type": "shape",
      "shape": "rect",
      "x": 410,
      "y": 53,
      "w": 100,
      "h": 12,
      "fill": "#202323",
      "rotation": 35
    },
    {
      "id": "lower",
      "name": "Lower",
      "type": "shape",
      "shape": "rect",
      "x": 410,
      "y": 117,
      "w": 100,
      "h": 12,
      "fill": "#202323",
      "rotation": -35
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
