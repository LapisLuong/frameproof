import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_caption",
  "name": "Caption",
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
      "h": 2,
      "fill": "#202323"
    },
    {
      "id": "caption",
      "name": "Caption",
      "role": "info",
      "type": "text",
      "text": "Bảo tàng / Chú thích tác phẩm",
      "x": 0,
      "y": 35,
      "w": 600,
      "h": 100,
      "size": 28,
      "font": "archivo",
      "color": "#202323"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
