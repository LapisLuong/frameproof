import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_numeral",
  "name": "Numeral",
  "kind": "type",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "numeral",
      "name": "Numeral",
      "type": "text",
      "text": "02",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 180,
      "size": 170,
      "font": "archivo",
      "color": "#202323",
      "weight": 900
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
