import type { ArtDirection, Brief, ComposeMethod } from "./direction";
import { layoutText, type Measure } from "./layout";
import { docFromTemplate, type Template } from "./library";
import { applyColourMap, mapToDirection } from "./palette";
import { BUILTIN_FONTS, isBuiltinFont, LayerSchema, type DesignDoc, type FontRef, type Layer, type LayerRole, type TextLayer } from "./schema";
import { hasItalic, nearestWeight } from "./fonts";

/**
 * Deterministic concept composer: brief + art direction + pictures → editable designs, built only from existing
 * templates (by concept family), layer roles, the direction's palette and fonts, and real resource ids. No pixels are
 * generated and nothing is "learned": the same input always gives the same three designs, and each one says which
 * template it came from and what was changed.
 *
 * An AI direction (src/lib/ai/direction.ts) can choose the templates and picture order; the layers are still built here.
 */

export type ComposePicture = { id: string; width?: number; height?: number };

export type ComposeInput = {
  brief: Brief;
  direction: ArtDirection;
  /** The user's pictures first, then any built-in art they allowed, in the order to use them. */
  pictures: ComposePicture[];
  templates: Template[];
  measure: Measure;
  /** Optional AI choices: per concept, a template id and picture order. Unknown ids are ignored, never guessed. */
  choices?: Array<{ templateId: string; photoOrder?: string[]; note?: string }>;
  model?: string;
};

export type Concept = {
  doc: DesignDoc;
  method: ComposeMethod;
  /** Plain sentences on what was done, shown with the result. */
  notes: string[];
};

/** Role of a layer: its declared role, or a guess from its name for layers without one. */
export function layerRole(l: Layer): LayerRole | undefined {
  if (l.role) return l.role;
  const n = l.name.toLowerCase();
  if (l.type === "image") return "photo";
  if (l.type !== "text") return undefined;
  if (/\btitle\b|headline|masthead/.test(n)) return "title";
  if (/subtitle|dek|cover line/.test(n)) return "subtitle";
  if (/date|venue|info|time|hours|place/.test(n)) return "info";
  if (/credit|footer|folio/.test(n)) return "credit";
  return undefined;
}

/** Pick templates: walk the direction's concept families in order, one template per family, then fill up. */
export function pickTemplates(templates: Template[], concepts: ArtDirection["concepts"], count: number): Template[] {
  const picked: Template[] = [];
  const used = new Set<string>();
  const byConcept = (c: string) => templates.filter((t) => t.concept === c && !used.has(t.id));
  for (let round = 0; picked.length < count && round < 4; round++) {
    for (const c of concepts) {
      const t = byConcept(c)[0];
      if (t && picked.length < count) {
        picked.push(t);
        used.add(t.id);
      }
    }
  }
  for (const t of templates) {
    if (picked.length >= count) break;
    if (!used.has(t.id)) {
      picked.push(t);
      used.add(t.id);
    }
  }
  return picked;
}

/**
 * Fit a text layer's text into its box without splitting a word: shrink down to 25% of the template size, then, if
 * the text still doesn't fit, let the box grow downwards as far as the canvas allows. Returns the size and height
 * used and whether it fits. Layers named "(cropped)" are left alone: running off the edge is the idea.
 */
export function fitText(l: TextLayer, measure: Measure, canvasHeight = Infinity): { size: number; h: number; fits: boolean } {
  if (/\(cropped\)/i.test(l.name)) return { size: l.size, h: l.h, fits: true };
  const words = l.text.split(/\s+/).filter(Boolean);
  const check = (size: number, h: number) => {
    const out = layoutText({ ...l, size, h }, measure);
    // A split word shows up as line fragments that aren't whole words of the text.
    const whole = out.lines.every((line) => line.text.split(/\s+/).filter(Boolean).every((w) => words.includes(w)));
    return { whole, overflows: out.overflows, blockHeight: out.blockHeight };
  };
  let size = l.size;
  const min = Math.max(4, l.size * 0.25);
  let r = check(size, l.h);
  while (size > min && (!r.whole || r.overflows)) {
    size = Math.max(min, Math.floor(size * 0.94));
    r = check(size, l.h);
  }
  if (r.whole && !r.overflows) return { size, h: l.h, fits: true };
  // Still too long: grow the box (only downwards, never past the canvas edge) at the smallest size that keeps words whole.
  const room = Math.max(l.h, canvasHeight - l.y - Math.min(40, canvasHeight * 0.03));
  const h = Math.min(room, Math.ceil(r.blockHeight + 1));
  r = check(size, h);
  return { size, h, fits: r.whole && !r.overflows };
}

function setFont(l: TextLayer, font: FontRef): TextLayer {
  if (!isBuiltinFont(font)) return { ...l, font };
  const weight = nearestWeight(font, l.weight);
  return { ...l, font, weight, italic: l.italic && hasItalic(font, weight) };
}

/** Which direction font a text role gets: the display face for big type, the text face for information. */
const usesDisplay = (role: LayerRole | undefined, l: TextLayer) => role === "title" || role === "number" || role === "motif" || (role === undefined && l.size >= 120);

function composeOne(t: Template, input: ComposeInput, index: number, pictures: string[], choice?: NonNullable<ComposeInput["choices"]>[number]): Concept {
  const notes: string[] = [];
  let doc = docFromTemplate(t, `concept-${index + 1}-${t.id.slice(4)}`, 0);
  const { brief, direction, measure } = input;
  const lines = [...brief.lines];
  const infoLayers = doc.layers.filter((l) => l.type === "text" && layerRole(l) === "info").map((l) => l.id);
  let hidden = 0;
  let photo = 0;
  let filled = 0;
  const tooLong: string[] = [];

  const layers: Layer[] = doc.layers.map((l) => {
    const role = layerRole(l);
    if (l.type === "image") {
      if (role !== "photo") return l;
      const id = pictures[photo++ % Math.max(1, pictures.length)];
      if (!id) return l;
      filled++;
      return { ...l, resourceId: id };
    }
    if (l.type !== "text") return l;
    let next: TextLayer = setFont(l, usesDisplay(role, l) ? direction.fonts.display : direction.fonts.text);
    if (role === "title") next = { ...next, text: brief.title };
    else if (role === "subtitle") {
      if (brief.subtitle) next = { ...next, text: brief.subtitle };
      else {
        next = { ...next, hidden: true };
        hidden++;
      }
    } else if (role === "info") {
      const pos = infoLayers.indexOf(l.id);
      const last = pos === infoLayers.length - 1;
      // Extra brief lines go into the last information block rather than being dropped.
      const text = last ? lines.slice(pos).join("\n") : (lines[pos] ?? "");
      if (text) next = { ...next, text };
      else {
        next = { ...next, hidden: true };
        hidden++;
      }
    } else if (role === "kicker" || role === "credit" || role === "body") {
      // Template sample words the brief doesn't replace are hidden, not left in as fake content.
      next = { ...next, hidden: true };
      hidden++;
    }
    if (!next.hidden && (role === "title" || role === "subtitle" || role === "info")) {
      const fit = fitText(next, measure, doc.height);
      if (fit.size !== next.size || fit.h !== next.h) next = { ...next, size: fit.size, h: fit.h };
      if (!fit.fits) tooLong.push(next.name);
    }
    return LayerSchema.parse(next);
  });
  doc = { ...doc, layers };

  const map = mapToDirection(doc, direction.palette);
  doc = applyColourMap(doc, map);
  doc = { ...doc, name: `${brief.title} — ${t.name}`.slice(0, 120) };

  notes.push(`Composed from the “${t.name}” template (${t.concept.replace("-", " ")}).`);
  notes.push(`Type set in ${fontLabel(direction.fonts.display)} and ${fontLabel(direction.fonts.text)}; colours mapped onto your palette by role.`);
  if (filled) notes.push(`${filled} picture slot${filled === 1 ? "" : "s"} filled in the order given.`);
  else if (doc.layers.some((l) => l.type === "image" && l.resourceId === null)) notes.push("Picture slots are empty: add pictures to fill them.");
  if (hidden) notes.push(`${hidden} template text layer${hidden === 1 ? " was" : "s were"} hidden because the brief has nothing for ${hidden === 1 ? "it" : "them"}; show ${hidden === 1 ? "it" : "them"} in Layers.`);
  if (tooLong.length) notes.push(`${tooLong.join(", ")}: the text is too long for this layout even at a quarter of its size. Shorten it or enlarge the box.`);
  if (choice?.note) notes.push(`AI note: ${choice.note}`);
  const method: ComposeMethod = choice && input.model ? { kind: "ai-directed", templateId: t.id, model: input.model } : { kind: "deterministic", templateId: t.id };
  return { doc, method, notes };
}

const fontLabel = (f: FontRef) => (isBuiltinFont(f) ? BUILTIN_FONTS[f].label : "your font");

export function composeConcepts(input: ComposeInput, count = 3): Concept[] {
  const ids = new Set(input.templates.map((t) => t.id));
  const pictureIds = input.pictures.map((p) => p.id);
  const valid = (input.choices ?? []).filter((c) => ids.has(c.templateId));
  const chosen = valid.length ? valid.map((c) => input.templates.find((t) => t.id === c.templateId)!) : pickTemplates(input.templates, input.direction.concepts, count);
  return chosen.slice(0, count).map((t, i) => {
    const choice = valid[i];
    // An AI picture order may only reorder pictures the user supplied; unknown ids are dropped.
    const order = choice?.photoOrder?.filter((id) => pictureIds.includes(id)) ?? [];
    const rest = pictureIds.filter((id) => !order.includes(id));
    // Each concept starts at a different picture so three concepts don't all lead with the same one.
    const rotated = [...order, ...rest.slice(i % Math.max(1, rest.length)), ...rest.slice(0, i % Math.max(1, rest.length))];
    return composeOne(t, input, i, rotated, choice);
  });
}
