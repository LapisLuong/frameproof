import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_folio",
  "name": "Folio",
  "kind": "mark",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "issue",
      "name": "Issue",
      "role": "info",
      "type": "text",
      "text": "Tập 01 / Hà Nội",
      "x": 0,
      "y": 30,
      "w": 600,
      "h": 100,
      "size": 42,
      "font": "archivo",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
