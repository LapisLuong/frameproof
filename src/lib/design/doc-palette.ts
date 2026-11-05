import { applyColourMap, docColours } from "./palette";
import type { DesignDoc } from "./schema";

/**
 * The design's own palette as one editable list: every colour the design uses (background, text, fills, outlines,
 * lights), each linked to all the places it appears. An edit maps old colour → new colour across the whole design.
 *
 * Edits are always applied to the document as it was when the gesture began (`origin`), never to the result of the
 * previous slider step, so dragging back restores the colours exactly and two colours that pass through each other
 * mid-drag don't get merged.
 */

export type PaletteSession = { origin: DesignDoc; hexes: string[] };

export type DocSwatch = { hex: string; uses: number; label: string; locked: boolean };

const USE_LABEL = { background: "Background", text: "Text", fill: "Fill", stroke: "Outline" } as const;

/** Background first, then the most used colours, so the list reads in order of importance (ties by hex). */
function ordered(doc: DesignDoc) {
  const bg = doc.background.toLowerCase();
  return docColours(doc).sort((a, b) => Number(b.hex === bg) - Number(a.hex === bg) || b.uses - a.uses || a.hex.localeCompare(b.hex));
}

export function docSwatches(doc: DesignDoc): DocSwatch[] {
  const locked = new Set(doc.lockedColours.map((h) => h.toLowerCase()));
  return ordered(doc).map((c) => {
    const roles = c.roles.map((r) => (r in USE_LABEL ? USE_LABEL[r as keyof typeof USE_LABEL] : "Light"));
    const label = roles.includes("Background") ? "Background" : `${[...new Set(roles)].join(" + ")}${c.uses > 1 ? ` ×${c.uses}` : ""}`;
    return { hex: c.hex, uses: c.uses, label, locked: locked.has(c.hex.toLowerCase()) };
  });
}

export function startSession(doc: DesignDoc): PaletteSession {
  return { origin: doc, hexes: ordered(doc).map((c) => c.hex) };
}

/** The document with each session colour replaced by the one at the same index in `next`; locked colours stay. */
export function applyPaletteEdit(session: PaletteSession, next: string[]): DesignDoc {
  const locked = new Set(session.origin.lockedColours.map((h) => h.toLowerCase()));
  const map: Record<string, string> = {};
  session.hexes.forEach((from, i) => {
    const to = next[i];
    if (to && !locked.has(from.toLowerCase()) && to.toLowerCase() !== from.toLowerCase()) map[from] = to;
  });
  return Object.keys(map).length ? applyColourMap(session.origin, map) : session.origin;
}

/** Lock or unlock a colour (a brand or logo colour that palette edits must keep). */
export function toggleLock(doc: DesignDoc, hex: string): DesignDoc {
  const h = hex.toLowerCase();
  const has = doc.lockedColours.some((x) => x.toLowerCase() === h);
  return { ...doc, lockedColours: has ? doc.lockedColours.filter((x) => x.toLowerCase() !== h) : [...doc.lockedColours, h].slice(0, 24) };
}
