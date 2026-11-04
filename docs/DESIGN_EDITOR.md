# Poster editor (P1 + P2)

Branch `feat/poster-editor`. FrameProof gains a layer editor for posters and covers, so a designer can build the
"current" design inside the app and review it against a reference with the existing tools.

## Main acceptance flow (user, 2026-11-05)

References → brief and assets → art direction (palette, fonts, concept families) → **three editable layer concepts**
→ fine edit → export. The app composes the concepts itself from real ids (templates, items, built-in art, the user's
images and fonts); it doesn't only offer a picker.

- **Direction.** Palette is measured from the user's references (k-means in `src/lib/analysis`, labelled measured)
  and editable per swatch or as a whole palette in HSL; edits apply to linked colours across the design. Fonts and
  layout can't be read from pixels, so they are the user's choice or, when AI is configured, an AI suggestion,
  labelled as such (`src/lib/design/direction.ts`, every value carries its origin).
- **Compose.** Deterministic by default (`src/lib/design/compose.ts`): pick templates by concept family, place the
  brief into layers by `role`, fill photo slots with the user's images or built-in CC0 art, recolour through the
  palette by colour role, swap fonts. Labelled "Composed from template X" — never called AI or "trained".
- **AI direction (optional, server-only).** `/api/direction` asks a vision model to choose among existing ids only
  (palette suggestion, font ids, template ids, image order); answers are Zod-validated and id-checked, and the same
  deterministic composer builds the layers. Without a key the UI says so and offers the deterministic result.
- **Image tools (P3).** Background removal (BEN2, MIT, browser) and masked inpainting (LaMa, Apache-2.0, browser):
  results are new resources linked to their source, with preview / accept / cancel; text removal needs a painted
  mask (no OCR implied); editable text is edited, not inpainted. Real inference tests, never a mock passed off as
  working, never a colour-key presented as AI.
- **Motion.** Modern state transitions (gallery → editor, panels, layer list) at 120–240 ms, all off under
  `prefers-reduced-motion`; direct manipulation (drag, resize, rotate) is never tweened.

## Scope

In:
- Posters and covers with **text, image and shape layers**: select, move, resize, rotate, opacity, hide, lock,
  reorder, duplicate, delete; undo and redo.
- Editable type (font, size, weight, italic, line height, letter spacing, alignment), colour and layout.
- **Starter templates** with distinct concepts (exhibition, editorial cover, collage, music, type-as-image, event)
  and **reusable items** (type blocks, shapes, frames, marks, info blocks) to drop into any design.
- **User resources**: images and fonts the user adds, with licence and source fields, kept in IndexedDB.
- Save and reload; export as **PNG**, **SVG** (fonts and images embedded) and a **portable JSON bundle** that
  re-imports elsewhere.
- Mobile controls (390 px): layer sheet, inspector sheet, nudge buttons, no hover-only actions.
- **Review bridge (P2)**: send the rendered design to a project as its current image and review it; a proof note
  can select the layer it is about when the note has a location.

Out (on purpose):
- **No image generation**, now or in the backlog. Templates contain text, shapes, image slots and, in a few covers,
  public-domain museum artworks (The Met Open Access, CC0, provenance kept); collage layouts use the user's pictures.
  Inpainting (P3) reconstructs masked pixels of the user's own image on request; it never invents a new picture.
- No import from Figma or Canva links. A link is stored as a link (Library rule 8). Figma templates each need their
  own licence check and can't become editable documents from a URL; Canva autofill needs a real integration.
- No groups, masks, effects or multi-page documents in v1.

## Art direction for templates

Principles studied, never artwork copied (sources for reading: Cooper Hewitt's *How Posters Work*; type-as-image
and rhythm in contemporary event posters; arts and culture identity work):
- one focal point, decided by scale contrast, not by decoration;
- type can be the image: a word set huge, cropped by the edge, stacked or rotated;
- rhythm from repetition (rules, numerals, repeated words) and a clear grid underneath;
- information set small and orderly (date, place, credits) against the big gesture;
- limited palette, flat colour, no gradients or effects (same rules as the app's own UI);
- Vietnamese text in every template, so diacritics are tested in each typeface.

Templates must not look like generic adverts (no "SALE 50%", stock layouts or badge clutter).

## Document schema

`src/lib/design/schema.ts` (Zod, versioned, environment-neutral). Summary:

```ts
DesignDoc {
  schema: "frameproof.design"; version: 1;
  id; name; width; height;            // canvas px, 64..6000
  background: "#rrggbb";
  layers: Layer[];                     // [0] is the bottom of the stack, max 200
  templateId: string | null; projectId: string | null;
  createdAt; updatedAt;
}
Layer = common & (Text | Image | Shape)
  common  { id, name, x, y, w, h, rotation°, opacity 0..1, hidden, locked }
  Text    { type: "text", text, font: FontRef, size, weight, italic, lineHeight, letterSpacing(em),
            align: left|center|right, valign: top|middle|bottom, color }
  Image   { type: "image", resourceId: "res_…" | null (empty slot), fit: cover|contain, radius }
  Shape   { type: "shape", shape: rect|ellipse|line, fill | null, stroke | null, strokeWidth, radius }
FontRef = built-in id (src/lib/design/fonts.ts) | "res_…" (a user font)
```

Templates and items (`src/lib/design/library.ts`) are layer stacks with a required `licence {id, author, source}`.
Resources (`src/lib/design/resource.ts`) are `{id, kind: image|font, name, mime (sniffed), bytes, width?, height?,
licence, tags}` plus the Blob.

## Rendering

One renderer, `renderSvg(doc, options)` in `src/lib/design/render.ts`, produces an SVG string. The editor shows it,
SVG export saves it with fonts and images embedded, PNG export rasterises it. Text is laid out by
`layoutText` (`layout.ts`) with an injected `measure`, so lines break in the same place on screen and in exports;
text taller than its box is never clipped and the editor says so.

## Ownership

| Area | Owner | Files |
|---|---|---|
| Schema, fonts registry, layout, renderer, library contract, resource model | Claude Code | `src/lib/design/{schema,fonts,layout,render,library,resource}.ts`, `tests/unit/design.test.ts` |
| Store v2 (documents, resources), repo functions | Claude Code | `src/lib/store/*` |
| Editor UI `/design`, resources UI, review bridge, e2e | Claude Code | `src/app/design/*`, `src/components/design/*`, `tests/e2e/design*.spec.ts` |
| Template pack and reusable items | Codex CLI | `src/lib/design/templates/*`, `src/lib/design/items/*`, `tests/unit/design-templates.test.ts` |
| Export: SVG (embedded fonts), PNG, portable JSON bundle | Codex CLI | `src/lib/design/export.ts`, `tests/unit/design-export.test.ts` |
| Resource file validation (font and image magic bytes, limits) | Codex CLI | `src/lib/design/resource-validate.ts`, `tests/unit/resource-validate.test.ts` |
| Poster font pack (OFL, from github.com/google/fonts): manifest, licences, Vietnamese coverage | Codex desktop | delivered to `work/poster-fonts`; Claude integrates into `fonts.ts` |
| Palette tools (HSL, linked colours, roles), layer roles on the pack, AI direction route | Codex CLI | `src/lib/design/palette.ts`, `src/lib/ai/direction.ts`, `src/app/api/direction/route.ts`, tests |
| Deterministic composer, compose flow UI, palette panel, Desk gallery, motion, LaMa inpaint | Claude Code | `src/lib/design/compose.ts`, `src/app/compose/*`, `src/lib/design/inpaint*` |
| BEN2 background-removal runtime prototype, resource packs, acceptance | Codex desktop | isolated prototype → handed to Claude to integrate |
| Independent review, licence check, acceptance | Codex desktop | `docs/reviews/*` |

Nobody edits another owner's files; changes go through a note to the owner.

## Status

See `docs/QA.md` → "Poster editor".
