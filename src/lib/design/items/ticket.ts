import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_ticket",
  "name": "Ticket",
  "kind": "info",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "rule",
      "name": "Rule",
      "role": "motif",
      "type": "shape",
      "shape": "rect",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 3,
      "fill": "#202323"
    },
    {
      "id": "ticket",
      "name": "Ticket",
      "role": "info",
      "type": "text",
      "text": "24.10 / 20:00\nÂm nhạc / Hà Nội",
      "x": 20,
      "y": 25,
      "w": 560,
      "h": 130,
      "size": 32,
      "font": "archivo",
      "color": "#202323"
    },
    {
      "id": "rule-bottom",
      "name": "Rule Bottom",
      "role": "motif",
      "type": "shape",
      "shape": "rect",
      "x": 0,
      "y": 177,
      "w": 600,
      "h": 3,
      "fill": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
