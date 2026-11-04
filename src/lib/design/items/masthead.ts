import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_masthead",
  "name": "Masthead",
  "kind": "type",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "masthead",
      "name": "Masthead",
      "type": "text",
      "text": "Khoảng",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 160,
      "size": 120,
      "font": "playfair-display",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
