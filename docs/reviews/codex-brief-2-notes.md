# Brief 2 handoff

Worktree: `feat/poster-editor-codex`, starting HEAD `d9c48d5`. Changes remain uncommitted as requested. The pre-existing untracked `node_modules` symlink was left alone. No dependencies, environment files, owned contracts, client components or other routes were changed.

## Delivered

- `src/lib/design/palette.ts`: HSL conversion and clamped additive adjustments; whole-palette edits; colour inventory; estimated role inference using existing Oklab conversions; immutable, linked, single-pass replacement; direction mapping with support cycling, Oklab-lightness fallback and WCAG contrast fallback.
- Every template and reusable item layer now declares a semantic role. All eight templates have exactly one title, information, and photo roles on image slots. Added `tpl_music-columns` (navy, yellow programme rail and disc) and `tpl_collage-grid` (warm archive grid with three empty photo apertures). Vietnamese copy and existing poster font families only.
- `src/lib/ai/direction.ts`: bounded prompt/answer/input schemas, JSON/fenced-JSON extraction, explicit id rejection, duplicate photo-id rejection, three-concept validation, cancellation timer and stripped extra geometry. Uses fake providers in tests; no network calls in tests.
- `/api/direction`: optional GET configuration status and POST direction endpoint, following review route body-size, image-validation, sharp re-encoding and ProviderError status patterns. Unconfigured POST returns 503 with `code: "not-configured"`. No console logging added.
- Minimal provider change: image arrays replace the fixed tuple in `complete` and both provider payload builders; the existing review request still requires its fixed pair and its payload labels are unchanged.

## Integration and decisions

POST multipart fields:

- `reference`: repeat this field for 1–3 reference image files.
- `brief`: JSON object matching the existing `BriefSchema` (`title`, `subtitle`, `lines`, `intent`).
- `allowed`: JSON object with `fontIds`, `templateIds`, `imageIds`. Font and template lists must be nonempty; image ids may be empty.

Success: `{ ok: true, provider, model, direction }`. Direction has `palette`, `fonts`, exactly three `concepts`, and `notes`. Model choices are suggestions, never measurements. Unknown ids fail rather than being substituted. No model geometry is used. This endpoint requests once; it does not silently retry invalid directions.

Palette APIs use lowercase six-digit document hex values. `hexToHsl` returns `{ h, s, l }`; `hslToHex` accepts that object, and keeps floating-point HSL precision until RGB conversion. Deltas are additive percentage points for S/L and wrapping degrees for H. Colour use counts count each layer once, even when fill and stroke share a colour; the document background counts as one additional use. Hidden layers remain included because they still belong to the editable document.

Estimated inference precedence is ground, then ink, then accent, then support. Background keeps ground even if text uses it; ink is the largest non-ground text colour by `w*h*size`. Accent is the most chromatic remaining colour at chroma >= 0.08. Hex order breaks ties. Thus a highly chromatic ink retains its ink role. Support mapping cycles in sorted source-hex order. Missing roles use nearest Oklab lightness. Contrast fallback picks the best swatch the supplied direction offers; it cannot promise 4.5:1 if none of those swatches meets it.

## Contract feedback for Claude Code

- Contracts were read and left untouched. Existing schema roles and direction types are sufficient for this implementation.
- `DirectionAnswerSchema` describes the wire answer, which intentionally differs from `ArtDirectionSchema`: palette swatches omit origin; fonts omit origin; concepts select template ids, photo order and emphasis. The caller must add `ai-suggested` origins when converting into stored direction data. Review findings retain the product's `ai-observed` evidence terminology.
- `ai/direction.ts` is a server-side orchestration module importing the provider at runtime. Do not import it into client code; client-side revalidation needs an environment-neutral response schema in a Claude-owned shared contract before UI integration. No client currently imports this module or provider.ts.
- For two images the shared transport retains the review labels REFERENCE/CURRENT to preserve existing review behaviour. The direction system prompt explicitly says all images are references regardless of that transport label.
- Static builds remain independent: no client requires the endpoint, and existing API parking covers the new route without changes.

## Verification

- `npx tsc --noEmit -p .`: passed.
- Scoped `npx eslint` covering palette, templates, items, provider, direction module/route, and the three affected unit-test files: passed.
- `npx vitest run` (final run also writes JSON to `/tmp/frameproof-brief2-vitest.json`): **160 passed, 4 skipped, 164 total; 13 files passed, 1 skipped**. Skips are the existing unrecorded AI fixture suite.
- Focused counts: palette **10**, AI direction including real-route/fake-provider tests **22**, template pack **5**. Existing AI review tests **16** passed.
- `npm run build`: blocked by Turbopack resolving the pre-existing `node_modules` symlink outside the worktree root.
- `npx next build --webpack`: passed, including TypeScript and generation of both API routes.
- `npm run test:e2e`: blocked before tests start; sandbox rejects server listen on port 3100 with EPERM. No e2e tests ran.
- `node scripts/qa-screens.mjs http://localhost:3100 /tmp/frameproof-brief2-qa`: blocked launching Chromium (MachPort bootstrap permission denied). Required browser screens at 1440/1024/390 remain unverified.
- Independently rasterised both new templates locally with the shared SVG renderer and sharp; opened `/tmp/tpl_music-columns.png` and `/tmp/tpl_collage-grid.png`. Grid, spacing, palette and empty slots inspected. These use approximate text measurement and local raster font fallback, so they do not establish browser font/diacritic acceptance.
- `git diff --check`: passed.

## Intended commits

1. `feat(design): add linked palette editing and direction colour mapping`
2. `feat(design): annotate layer roles and add music and collage variants`
3. `feat(ai): add optional validated art direction endpoint`

Include this handoff note with the final commit. Do not stage the pre-existing `node_modules` symlink.
