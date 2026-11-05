import pack from "../../../public/library-pack/manifest.json";
import { BUILTIN_ART } from "../design/art";

export const LIBRARY_ART = [
  ...BUILTIN_ART.map((a) => ({ id: a.id, title: a.title, author: a.author, date: a.date, source: a.source, licence: "CC0-1.0", file: `/art/${a.file}`, width: a.width, height: a.height, builtin: true })),
  ...pack.records.map((a) => ({ ...a, id: `res_${a.id}`, file: `/library-pack/${a.file}`, builtin: false })),
];

/** Curated bookmarks, not a redistributed template collection. */
export const INSPIRATION_SOURCES = [
  { name: "Weekdone · free infographic kit", url: "https://weekdone.com/infographics", topic: "Vector infographic, timeline, chart, editorial information design", note: "Official free vector download with light and dark examples. External source; not presented as a native FrameProof template." },
  { name: "Figma · infographic example", url: "https://www.figma.com/templates/infographic-example/", topic: "Infographic structure, visual hierarchy, information layout", note: "Open the free example at its source. Check the resource and included-asset licences before redistribution." },
  { name: "Pinterest · poetic and experimental covers", url: "https://www.pinterest.com/search/pins/?q=poetic%20experimental%20book%20cover%20typography", topic: "Poetic book cover, expressive type, surreal collage, experimental editorial", note: "A focused inspiration search for lyrical and bold cover directions; individual designs are not bundled or copied." },
  { name: "Pinterest · art book covers", url: "https://www.pinterest.com/search/pins/?q=b%C3%ACa%20s%C3%A1ch%20ngh%E1%BB%87%20thu%E1%BA%ADt", topic: "Book cover, artistic typography, collage", note: "Use as visual reference. Individual images belong to their creators." },
  { name: "Land-book", url: "https://land-book.com/", topic: "Editorial rhythm, colour, website art direction", note: "Inspiration link. Its collection is not included in this asset pack." },
  { name: "GetLayers", url: "https://www.getlayers.ai/", topic: "Motion, gradients, website prompts", note: "Browse the source for its own download and licence terms; prompt library not redistributed here." },
  { name: "Font In Logo", url: "https://fontinlogo.com/", topic: "Logo typography references", note: "A reference to type choices, not a licence to download a brand's font." },
  { name: "Pageflows", url: "https://pageflows.com/", topic: "Interaction and real product flows", note: "Study workflows at the source. Screens and paid collections are not bundled." },
  { name: "Collect UI", url: "https://collectui.com/", topic: "Interface composition and graphic details", note: "Browse credited designers; check permission before reusing an individual work." },
  { name: "Google Fonts", url: "https://fonts.google.com/?subset=vietnamese", topic: "Vietnamese and English type families", note: "The built-in Font shelf contains self-hosted OFL families ready to use." },
  { name: "The Met Open Access", url: "https://www.metmuseum.org/art/collection", topic: "Paintings, botanicals, prints and ornamental art", note: "The artwork shelf bundles the individually checked public-domain works, with CC0 source credits." },
];
