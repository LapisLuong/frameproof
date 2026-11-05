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

## Campaign formats

`/campaign?id=` (opened from the editor's "Campaign formats", which saves first) recomposes one design for square,
4:5, story, banner, page cover, an 80 × 180 cm standee and a circle-safe avatar (`src/lib/design/campaign.ts`).
Rules, not stretching: words, fonts, colours, pictures and brand locks are kept; only placement and scale change.
Strategies: `anchor` (each layer keeps the edge or centre it was aligned to) and `split` / `split-mirrored`
(pictures in one zone, type in the other). Content is recomposed into `safeBox(format)`: the square inside the
avatar circle, the story area between the platform's top and bottom bands (approximate). Full-bleed layers refill
the canvas. Every scaled size is capped at the schema limit, and a capped layer is named in the notes. Each saved
variant is a new design with `sourceDesignId`. Notes are honest: overflow, very small type, crop by the circle
(using rotated corners), and the standee's real print DPI (about 85 at 2667 × 6000 px) with a pointer to SVG.

**Avatar frame** (`avatarFrame`, format "Avatar frame (transparent centre)"): a new 1080 × 1080 design with
`transparent: true` (no background fill; PNG and SVG keep the transparency, the editor shows a checkerboard). It
is built from the source, not cropped from it: a ring in the design's ground colour, a hairline in the title colour,
the title on a label in the lower band (one line, shrunk to fit, with a note if it can't), and the layer marked as
the logo, whole, at the top. The middle `FRAME_CLEAR` (70%) of the diameter stays empty, which a unit test checks
geometrically and an e2e test checks on the exported PNG's alpha channel. Every layer left out is named in the notes
and stays in the original. The copy says it's a file to upload yourself; nothing connects to a social network.

**Logo**: images added with "This is a logo" are tagged `logo` and listed under Add → Your logos for every design.
"Place logo" puts one on its own layer (`role: "logo"`, fit contain, a fifth of the short side, bottom-right).
Any picture layer can be marked "This picture is the logo". The logo is always assigned by the user; FrameProof
never guesses which picture is a logo.

Not yet: per-format recipes with group distribution for several info or photo layers (see the Codex/Gemini
campaign handoff); text on a curve for frame labels.

## Image tools

Contract: `src/lib/image-tools/types.ts`. Runtimes run in a worker in the browser; the runtime is served
same-origin (`npm run prepare:image-tools`, run before dev and build); weights are fetched from a pinned
revision only after the user starts the tool. Background removal (BEN2) is wired in the Inspector for picture
layers (`CutoutDialog`): a confirmation names the model, licence, size and source; there's progress with Cancel;
the preview compares the result with the original and states its real size. Accepting stores a new resource with
`derivedFrom: { resourceId, tool, model }` and switches the layer as one undo step. If saving fails, the result
stays in the dialog with "Retry save"; the model never runs twice for one result.

"Fill an area" (LaMa) works the same way. The mask is painted with a brush (Paint, Erase, Undo stroke, Clear) or
marked as a rectangle typed in picture pixels, which is the keyboard alternative. It's made at the picture's own
size, white means reconstruct. Pictures over 4 MP are refused with the reason, before anything downloads. The
preview says the filled area is the model's reconstruction. Cancel returns to the same mask. Only one model runs at
a time per tab (`execution-slot`).

## Code map

| Area | Files |
|---|---|
| Schema, fonts registry, layout, renderer, library contract, resource model | `src/lib/design/{schema,fonts,layout,render,library,resource}.ts`, `tests/unit/design.test.ts` |
| Store v2 (documents, resources), repo functions | `src/lib/store/*` |
| Editor UI `/design`, resources UI, review bridge, e2e | `src/app/design/*`, `src/components/design/*`, `tests/e2e/design*.spec.ts` |
| Template pack and reusable items | `src/lib/design/templates/*`, `src/lib/design/items/*`, `tests/unit/design-templates.test.ts` |
| Export: SVG (embedded fonts), PNG, portable JSON bundle | `src/lib/design/export.ts`, `tests/unit/design-export.test.ts` |
| Resource file validation (font and image magic bytes, limits) | `src/lib/design/resource-validate.ts`, `tests/unit/resource-validate.test.ts` |
| Poster font pack (OFL, from github.com/google/fonts): manifest, licences, Vietnamese coverage | `src/app/fonts/SOURCES.md`, `src/lib/design/fonts.ts` |
| Palette tools (HSL, linked colours, roles), layer roles on the pack, AI direction route | `src/lib/design/palette.ts`, `src/lib/ai/direction.ts`, `src/app/api/direction/route.ts`, tests |
| Deterministic composer, compose flow UI, palette panel, Desk gallery, campaign formats, image-tool UI, motion | `src/lib/design/{compose,campaign,doc-palette}.ts`, `src/app/{compose,campaign}/*`, `src/components/design/CutoutDialog.tsx` |
| Image-tool runtimes (BEN2 cutout, LaMa inpaint), workers, runtime packaging | `src/lib/image-tools/*` except `types.ts`, `scripts/prepare-image-tools.mjs`, `package.json` deps |
| API request guard (Origin, Fetch Metadata, multipart) | `src/lib/security/request.ts`, `tests/unit/security-request.test.ts` |


## Status

See `docs/QA.md` → "Poster editor".
