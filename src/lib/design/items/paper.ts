import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_paper",
  "name": "Paper",
  "kind": "shape",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "paper",
      "name": "Paper",
      "type": "shape",
      "shape": "rect",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 160,
      "fill": "#eee7d5"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
