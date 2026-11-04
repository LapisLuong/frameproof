import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_title",
  "name": "Title",
  "kind": "type",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "title",
      "name": "Title",
      "role": "title",
      "type": "text",
      "text": "Triển lãm",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 160,
      "size": 90,
      "font": "anton",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
