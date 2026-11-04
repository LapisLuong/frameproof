import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_lineup",
  "name": "Lineup",
  "kind": "type",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "lineup",
      "name": "Lineup",
      "role": "info",
      "type": "text",
      "text": "MÂY / SÓNG / ĐÊM",
      "x": 0,
      "y": 30,
      "w": 600,
      "h": 120,
      "size": 59,
      "font": "anton",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
