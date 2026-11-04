import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_stacked",
  "name": "Stacked",
  "kind": "type",
  "width": 600,
  "height": 300,
  "layers": [
    {
      "id": "stacked",
      "name": "Stacked",
      "type": "text",
      "text": "CHỮ\nVÀ HÌNH",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 300,
      "size": 85,
      "font": "archivo",
      "color": "#202323",
      "weight": 900
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
