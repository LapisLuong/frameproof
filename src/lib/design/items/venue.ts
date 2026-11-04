import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_venue",
  "name": "Venue",
  "kind": "info",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "venue",
      "name": "Venue",
      "type": "text",
      "text": "Nhà hát Lớn\nHà Nội / Thiết kế: Studio",
      "x": 0,
      "y": 0,
      "w": 600,
      "h": 160,
      "size": 34,
      "font": "archivo",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
