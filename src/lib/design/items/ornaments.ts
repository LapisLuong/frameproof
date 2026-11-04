import { ItemSchema, OWN_LICENCE, type Item, type ItemInput } from "../library";

/** Original closed silhouettes, drawn directly in a 1000-unit frame; no font outlines. */
export const ORNAMENT_PATHS = {
  "swash-long": "M20 650 C240 250 480 750 690 460 C800 310 915 360 980 420 C860 370 800 390 720 500 C490 830 240 340 20 650 Z",
  "swash-loop": "M20 690 C220 420 490 720 680 470 C850 210 990 400 900 540 C810 680 640 540 700 420 C640 600 820 700 930 550 C1080 330 810 160 650 450 C470 690 230 410 20 690 Z",
  "diamond-divider": "M15 495 C180 430 280 430 425 490 L425 510 C270 465 175 465 15 505 Z M455 500 L500 390 L545 500 L500 610 Z M575 490 C720 430 820 430 985 495 L985 505 C825 465 730 465 575 510 Z",
  "corner-flourish": "M80 920 C90 480 150 150 830 80 C350 170 210 240 155 480 C270 290 530 260 570 400 C600 530 400 600 370 470 C410 540 535 500 520 420 C490 300 260 370 160 600 C120 720 100 830 80 920 Z",
  "sparkle-star": "M500 30 C525 370 630 475 970 500 C630 525 525 630 500 970 C475 630 370 525 30 500 C370 475 475 370 500 30 Z",
  "three-stars": "M340 110 Q365 410 650 440 Q365 465 340 780 Q315 465 30 440 Q315 410 340 110 Z M780 25 Q795 180 960 200 Q795 220 780 375 Q765 220 600 200 Q765 180 780 25 Z M760 590 Q780 745 955 770 Q780 795 760 965 Q740 795 565 770 Q740 745 760 590 Z",
  "double-rule": "M25 430 H435 V450 H25 Z M565 430 H975 V450 H565 Z M25 550 H435 V570 H25 Z M565 550 H975 V570 H565 Z M500 450 C565 450 565 550 500 550 C435 550 435 450 500 450 Z",
  "laurel-sprig": "M150 940 Q510 600 820 70 L838 80 Q560 600 170 950 Z M270 825 Q80 770 110 570 Q290 625 270 825 Z M385 705 Q210 620 250 440 Q430 510 385 705 Z M505 565 Q350 460 415 290 Q570 385 505 565 Z M630 395 Q505 275 585 140 Q725 250 630 395 Z M315 785 Q365 590 565 620 Q495 795 315 785 Z M455 630 Q520 445 705 475 Q620 655 455 630 Z M585 455 Q665 275 835 300 Q755 475 585 455 Z M730 245 Q705 95 875 30 Q895 195 730 245 Z",
} as const;

const drawings: Array<[keyof typeof ORNAMENT_PATHS, string, number, number, string[]]> = [
  ["swash-long", "Tapered S swash", 800, 120, ["swash", "underline", "curve"]],
  ["swash-loop", "Looped swash", 720, 160, ["swash", "loop", "underline"]],
  ["diamond-divider", "Diamond flourish divider", 800, 100, ["divider", "diamond", "flourish"]],
  ["corner-flourish", "Corner flourish", 260, 260, ["corner", "flourish"]],
  ["sparkle-star", "Four-point sparkle", 200, 200, ["star", "sparkle"]],
  ["three-stars", "Three-star cluster", 300, 300, ["stars", "cluster"]],
  ["double-rule", "Double rule with dot", 800, 100, ["rule", "divider", "dot"]],
  ["laurel-sprig", "Laurel sprig", 220, 360, ["botanical", "sprig", "laurel"]],
];
export type TaggedItem = Item & { tags: string[] };
export const ORNAMENTS: TaggedItem[] = drawings.map(([id, name, width, height, tags]) => ({
  ...ItemSchema.parse({ id: `item_${id}`, name, kind: "mark", width, height, licence: OWN_LICENCE,
    layers: [{ id, name, role: "motif", type: "shape", shape: "path", path: ORNAMENT_PATHS[id], x: 0, y: 0, w: width, h: height, fill: "#bd9664" }],
  }), tags,
}));
const lights: Array<ItemInput & { tags: string[] }> = [
  { id: "item_beam-sparkles", name: "Light beam with sparkles", kind: "mark", width: 600, height: 900, licence: OWN_LICENCE, tags: ["light", "beam", "sparkle"], layers: [
    { id: "beam", name: "Light beam", role: "motif", type: "effect", effect: "beam", color: "#eee9fb", x: 0, y: 0, w: 600, h: 900, intensity: .55, spread: .6, blur: 16, seed: 17 },
    { id: "sparkles", name: "Sparkles", role: "motif", type: "effect", effect: "sparkle", color: "#f5efd9", x: 100, y: 200, w: 400, h: 600, intensity: .8, spread: .18, seed: 29 },
  ] },
  { id: "item_glowing-trail", name: "Glowing trail", kind: "mark", width: 800, height: 300, licence: OWN_LICENCE, tags: ["light", "trail", "sparkle"], layers: [
    { id: "trail", name: "Light trail", role: "motif", type: "effect", effect: "trail", color: "#e6bd65", x: 0, y: 0, w: 800, h: 300, intensity: .7, spread: .25, curve: .35, seed: 7 },
    { id: "sparkles", name: "Sparkles", role: "motif", type: "effect", effect: "sparkle", color: "#f5efd9", x: 80, y: 40, w: 640, h: 220, intensity: .8, spread: .12, seed: 31 },
  ] },
];
ORNAMENTS.push(...lights.map(({ tags, ...item }) => ({ ...ItemSchema.parse(item), tags })));
