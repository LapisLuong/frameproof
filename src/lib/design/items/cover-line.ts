import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_cover-line",
  "name": "Cover Line",
  "kind": "type",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "cover-line",
      "name": "Cover Line",
      "role": "subtitle",
      "type": "text",
      "text": "Một mùa ký ức",
      "x": 0,
      "y": 10,
      "w": 600,
      "h": 150,
      "size": 65,
      "font": "fraunces",
      "color": "#202323",
      "italic": true
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
