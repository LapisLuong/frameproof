# Poster style pack handoff

Changes are uncommitted on `feat/poster-editor-codex`. No dependencies, environment files, lead-owned contracts, renderer, composer or UI files were changed. The pre-existing untracked `node_modules` symlink remains untouched. No remote URLs, downloaded artwork, generated images or copied glyph outlines were added.

## Delivered

- `src/lib/design/palette.ts`: effect colour counts as one fill use; explicit linked colour edits include all effects, immutably and without chaining replacements. Inferred roles retain ground/ink precedence. Light glow/beam/trail/sparkle colours (estimated Oklab L >= 0.7) become accents. Texture-only grain/vignette colours have no inferred role, so direction mapping leaves them alone; colours shared with ordinary layers or light effects retain the existing linked role. Explicit palette edits can still recolour unique texture colours.
- `src/lib/design/items/ornaments.ts`: eight original, handwritten closed path silhouettes in a 1000-unit box: tapered S swash, looped swash, diamond flourish divider, corner flourish, four-point sparkle, three-star cluster, double rule with dot, laurel sprig. All paths are below 4 KB. Two editable effect composites provide a beam with sparkles and a glowing trail. All ten have motif roles, English names, tags and OWN_LICENCE; all are registered in ITEMS.
- Three registered templates: `tpl_lyrical-night` (editorial-cover), `tpl_new-chapter` (exhibition), `tpl_spotlight` (music). They use the specified dimensions, colours, local fonts, Vietnamese sample copy, empty image slots and editable effects. Lyrical night uses one two-line title and a separately sized subtitle word to retain one canonical title role while stepping the sample typography. Spotlight's Logo slot is an image with motif role, so the composer does not fill it with a performer photo. Photo slots precede light layers; type precedes the final sparkles.
- Tests cover schema validity, fonts/weights, roles, empty slots, the requested composed Vietnamese title with approxMeasure, compact filled paths, SVG rendering, retained tags, effect colour inventory/mapping, texture preservation and role precedence. Existing pack size and image-role assertions were updated for the additional templates and intentional logo slot.

## Decisions and lead-owned follow-ups

- `src/lib/design/library.ts`, `ItemSchema`: there is no tags property, and Zod strips unknown fields. Proposed fix: add bounded tags to ItemSchema (and its input/output types) if search/filter/persistence should understand tags. For now `TaggedItem` in ornaments.ts retains tags after parsing, and the items index appends the parsed tagged ornaments without parsing them again. `getItem` still returns the existing Item contract; consumers needing tags require a contract update.
- `src/lib/design/compose.ts`, `setFont` / `usesDisplay`: composing replaces every font, including Great Vibes ornamental words/initials. A kicker uses the direction's text font; a motif initial uses its display font. Proposed fix: introduce an explicit preserve-font option for ornamental text, or a role-aware typography policy that preserves script ornament faces. Current templates render their intended scripts directly; composition follows the existing composer contract.
- `src/lib/design/compose.ts`, motif content: the sample C initial in New chapter remains C when the brief changes because motif text is intentionally not replaced. Proposed fix: support a declared title-initial binding for ornamental initials, then derive it from the brief title. Do not guess this binding for arbitrary motif text.
- `docs/DESIGN_EDITOR.md`: the older scope/art-direction paragraphs still exclude effects and describe only three layer types. Proposed fix: update to match EffectLayer and path ornaments, explicitly separating artwork effects from the app UI restrictions.

## Verification

Final runs after all code changes:

- `npx tsc --noEmit -p .`: passed, exit 0.
- `npx eslint src tests`: passed, exit 0, no warnings.
- `npx vitest run`: passed, exit 0; 15 test files passed, 1 skipped; 191 tests passed, 4 skipped. Vitest emits the existing Vite config-loader warning about ESM syntax in vitest.config.ts loaded as CommonJS.
- `git diff --check`: passed.
- `next build` was not run, as requested. Production e2e and qa-screens.mjs were not run because they require the built server.

Visual verification is partial: generated temporary local HTML previews from renderSvg with embedded built-in font files, then attempted Playwright captures at 1440/1024/390. Chromium launch failed with `bootstrap_check_in ... Permission denied (1100)` / MachPortRendezvous sandbox denial. No browser screenshots were obtained. Inspected sharp-rasterised SVG previews of all three templates and the ornament sheet using a fallback serif (therefore this verifies general geometry/effects, not the exact font faces or responsive app UI). Moved New chapter's oversized initial into the upper-right margin after that inspection. Temporary preview generation test was removed; preview artifacts are in /tmp only. The lead should run exact-font browser visual QA at all three widths and the normal production e2e checks before accepting.
