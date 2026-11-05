import type { Licence } from "./library";

/**
 * Public-domain artworks shipped with the app for recomposition (The Met Open Access; each object record checked for
 * isPublicDomain: true; licence CC0 1.0). These are museum works, not FrameProof illustrations, and nothing here is
 * generated. The files in public/art are web-sized JPEG copies (long side 2000 px) of the originals; the original
 * file hashes, image URLs and policy link are in public/art/manifest.json.
 *
 * They act as read-only resources: a layer points at them with the same "res_…" ids as the user's own images.
 */
export type BuiltinArt = {
  id: `res_${string}`;
  /** Short label for menus. */
  name: string;
  /** Title as the museum gives it. */
  title: string;
  author: string;
  date: string;
  file: string;
  width: number;
  height: number;
  bytes: number;
  source: string;
  originalSha256: string;
};

export const BUILTIN_ART: readonly BuiltinArt[] = [
  {
    id: "res_met-360446",
    name: "Botanical Study",
    title: "Botanical Study",
    author: "Mary Delany",
    date: "ca. 1772–82",
    file: "met-360446.jpg",
    width: 1781,
    height: 2000,
    bytes: 353460,
    source: "https://www.metmuseum.org/art/collection/search/360446",
    originalSha256: "518c12434769b5fb7439c6ff6ca8d6e48833d1b275493db4b8454491d5ff9aa0",
  },
  {
    id: "res_met-283063",
    name: "Botanical Specimen",
    title: "[Botanical Specimen]",
    author: "William Henry Fox Talbot",
    date: "ca. 1835",
    file: "met-283063.jpg",
    width: 1308,
    height: 2000,
    bytes: 123403,
    source: "https://www.metmuseum.org/art/collection/search/283063",
    originalSha256: "452a527008dd00dc9ac191cd6ea18e78d419bd56f1a9a0fb54227bd8a6250d10",
  },
  {
    id: "res_met-362545",
    name: "Botanical Studies",
    title: "Botanical Studies (recto); Botanical Studies (verso)",
    author: "Anonymous, French, 19th century",
    date: "ca. 1820",
    file: "met-362545.jpg",
    width: 1300,
    height: 2000,
    bytes: 187427,
    source: "https://www.metmuseum.org/art/collection/search/362545",
    originalSha256: "28027f0e0a14f5fd8b00e14acbd695bedeb16001896db7c66e20c06879828948",
  },
  {
    id: "res_met-39799",
    name: "The Great Wave",
    title: "Under the Wave off Kanagawa (Kanagawa oki nami ura), or The Great Wave, from the series Thirty-six Views of Mount Fuji (Fugaku sanjūrokkei)",
    author: "Katsushika Hokusai",
    date: "ca. 1830–32",
    file: "met-39799.jpg",
    width: 2000,
    height: 1367,
    bytes: 521527,
    source: "https://www.metmuseum.org/art/collection/search/39799",
    originalSha256: "b410eeec0473c4e63eef12434a5a7c4613401c6e18670718d7727f36a441495c",
  },
  {
    id: "res_met-436528",
    name: "Irises",
    title: "Irises",
    author: "Vincent van Gogh",
    date: "1890",
    file: "met-436528.jpg",
    width: 2000,
    height: 1586,
    bytes: 788090,
    source: "https://www.metmuseum.org/art/collection/search/436528",
    originalSha256: "6b851d821d565e61817250b272417c79721724f8dba2deaffe9b4c9ca4c35685",
  },
  {
    id: "res_met-384889",
    name: "Wallpaper design with flowers",
    title: "Design for wallpaper featuring flowers and latticework",
    author: "Jules-Edmond-Charles Lachaise",
    date: "1830–97",
    file: "met-384889.jpg",
    width: 1964,
    height: 2000,
    bytes: 517986,
    source: "https://www.metmuseum.org/art/collection/search/384889",
    originalSha256: "e79f7a31651cdfba974c96335c44b71173c54db3b615b829a8e813f277f95a20",
  },
];

export const MET_POLICY = "https://www.metmuseum.org/policies/image-resources";

export const artLicence = (a: BuiltinArt): Licence => ({ id: "CC0-1.0", author: `${a.author}, The Met`.slice(0, 120), source: a.source });

const byId = new Map<string, BuiltinArt>(BUILTIN_ART.map((a) => [a.id, a]));
export const getBuiltinArt = (id: string): BuiltinArt | undefined => byId.get(id);
export const isBuiltinArt = (id: string): boolean => byId.has(id);
