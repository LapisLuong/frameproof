import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_date",
  "name": "Date",
  "kind": "info",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "day",
      "name": "Day",
      "role": "info",
      "type": "text",
      "text": "24",
      "x": 0,
      "y": 0,
      "w": 190,
      "h": 160,
      "size": 130,
      "font": "anton",
      "color": "#202323"
    },
    {
      "id": "month",
      "name": "Month",
      "role": "info",
      "type": "text",
      "text": "Tháng Mười\n2026",
      "x": 220,
      "y": 30,
      "w": 380,
      "h": 120,
      "size": 36,
      "font": "archivo",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
