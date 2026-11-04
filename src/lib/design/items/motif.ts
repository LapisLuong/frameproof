import { ItemSchema, OWN_LICENCE, type ItemInput } from "../library";
export const item: ItemInput = {
  "id": "item_motif",
  "name": "Motif",
  "kind": "shape",
  "width": 600,
  "height": 180,
  "layers": [
    {
      "id": "disc0",
      "name": "Disc0",
      "role": "motif",
      "type": "shape",
      "shape": "ellipse",
      "x": 0,
      "y": 0,
      "w": 120,
      "h": 120,
      "fill": "#d65b35"
    },
    {
      "id": "disc1",
      "name": "Disc1",
      "role": "motif",
      "type": "shape",
      "shape": "ellipse",
      "x": 150,
      "y": 0,
      "w": 120,
      "h": 120,
      "fill": "#d65b35"
    },
    {
      "id": "disc2",
      "name": "Disc2",
      "role": "motif",
      "type": "shape",
      "shape": "ellipse",
      "x": 300,
      "y": 0,
      "w": 120,
      "h": 120,
      "fill": "#d65b35"
    },
    {
      "id": "disc3",
      "name": "Disc3",
      "role": "motif",
      "type": "shape",
      "shape": "ellipse",
      "x": 450,
      "y": 0,
      "w": 120,
      "h": 120,
      "fill": "#d65b35"
    }
  ]
, "licence": OWN_LICENCE };
ItemSchema.parse(item);
