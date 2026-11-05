import { getBuiltinArt } from "./art";
import { docFromTemplate, type Template } from "./library";
import type { DesignDoc } from "./schema";
import { TEMPLATES } from "./templates";

/**
 * Finished starters: a template whose picture slots are already filled with public-domain museum art (The Met Open
 * Access, CC0), so a first visit shows complete designs that open straight into the editor. Templates without
 * picture slots are complete on their own and appear as they are. Nothing here is generated.
 */
export type Starter = { id: string; template: Template; art: string[] };

const FILLS: Record<string, string[]> = {
  "tpl_editorial-image": ["res_met-39799"],
  tpl_collage: ["res_met-360446", "res_met-436528", "res_met-384889"],
  "tpl_collage-grid": ["res_met-39799", "res_met-360446", "res_met-362545"],
  "tpl_lyrical-night": ["res_met-39799"],
  "tpl_new-chapter": ["res_met-360446", "res_met-436528"],
  tpl_spotlight: ["res_met-436528"],
};

const photoSlots = (t: Template) => t.layers.filter((l) => l.type === "image" && (l.role === "photo" || l.role === undefined)).length;

export const STARTERS: Starter[] = TEMPLATES.flatMap((t) => {
  const art = FILLS[t.id];
  if (art) return [{ id: `st_${t.id.slice(4)}`, template: t, art }];
  return photoSlots(t) === 0 ? [{ id: `st_${t.id.slice(4)}`, template: t, art: [] }] : [];
});

/** What the Desk shows first: the light-and-ornament styles, then picture-led covers, then type. */
const DESK_ORDER = ["tpl_lyrical-night", "tpl_new-chapter", "tpl_spotlight", "tpl_editorial-image", "tpl_collage", "tpl_music"];
export const DESK_STARTERS: Starter[] = [...STARTERS].sort((a, b) => rank(a) - rank(b));
function rank(s: Starter) {
  const i = DESK_ORDER.indexOf(s.template.id);
  return i < 0 ? DESK_ORDER.length : i;
}

/** The starter as a design: the template with its picture slots filled, in order, by the starter's artworks. */
export function starterDoc(s: Starter, id: string, now = Date.now()): DesignDoc {
  const doc = docFromTemplate(s.template, id, now);
  let i = 0;
  const layers = doc.layers.map((l) => {
    if (l.type !== "image" || (l.role !== "photo" && l.role !== undefined) || l.resourceId) return l;
    const art = s.art[i++];
    return art && getBuiltinArt(art) ? { ...l, resourceId: art } : l;
  });
  return { ...doc, layers };
}
