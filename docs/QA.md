# QA report

Last verified: 4 Nov 2026, on Linux (Node 22, Chromium 1243) and macOS arm64 (Node 24/26).

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` (strict, `noUncheckedIndexedAccess`) | pass |
| `npm run lint` (eslint-config-next core-web-vitals + TypeScript) | pass, 0 warnings |
| `npm test` (Vitest) | 37 / 37 pass — colour conversion, WCAG, palette, structure, similarity, aspect labels, upload validation (PNG/JPEG headers, bombs, fake files), review rules, AI config/validation/retry |
| `npm run build` | pass on Linux and macOS |
| `npm run test:e2e` (Playwright) | 9 / 9 pass — full journey, fake-image rejection, library, analyzer → style → CSS, AI route unconfigured, keyboard skip link, sample project with no horizontal overflow at 1440 and 390 px, reduced motion |

The end-to-end journey covers: create project → upload reference and current → automatic local review → genuine
sizes in the measurement table → slider, overlay and difference modes → mark a note resolved → save notes →
reload (state persists) → export Markdown and JSON (contents checked) → second review version → desk lists project.

## Visual QA

Screenshots in `qa/screenshots/` at 1440, 1024 and 390 px were inspected after each round. Fixes made from them:

- Margin notes moved directly under the stage on narrow screens (they were below all measurements).
- Duplicate AI-status sentence removed; review now says "Local measurements only."
- Empty desk: one prompt instead of two competing dark buttons and three empty sidebar sections.
- Palette swatches from the analyzer are named neutrally ("Colour 1"), not "Primary/Accent" by rank; swatches under 1% are dropped from saved styles and shown as "<1%".
- Gap under the comparison stage on desktop (grid row stretched by the margin column) fixed.

## Independent critique (AI council, round 2)

ChatGPT (GPT-6.1, Work mode) reviewed five screenshots without having seen the build and scored the UI **7/10**
("editorial restraint feels intentional; still reads a little like a diagnostic report"). Orders and outcomes:

| Order | Outcome |
| --- | --- |
| Mobile side-by-side stacks two huge frames | Fixed: on ≤ 640 px one image at a time with a Reference/Current toggle that keeps zoom and position |
| Contrast finding overstates evidence | Fixed: retitled "Check text contrast", confidence low, explains that pixel counts can't tell which colours sit behind text |
| Upload boxes duplicate the workspace after images exist | Fixed: compact filename row with "Replace…" |
| Configuration text interrupts the review | Fixed: moved to README; review shows "Local measurements only." |
| Library previews too small | Fixed: 15 rem previews, wider grid |
| Repeated metadata stacks feel generated | Fixed: one metadata line; confidence moved into "How to fix it" |
| Numbered anchors on the artwork | Deferred — only one rule has a location today (see milestones) |
| Sample current poster looks deliberately weak | Acknowledged; it is a teaching sample and is labelled "Sample" |

Gemini 3.1 Pro reviewed the computer-vision and security plan in round 1 (k-means in Oklab, SSIM/dHash parameters,
magic bytes and pixel caps were adopted; its proposal to let the model fill a "measurements" block was rejected).
In round 2 it could not open the GitHub links and said so rather than guessing; the in-browser hand-off of the source
failed (clipboard and CSP restrictions), so the **independent code review is still open** (milestone 2).

## Known limitations

- **AI review has not been run against a live provider** in this environment (no key). The provider layer, schema,
  retry and failure paths are unit-tested with a fake provider; the unconfigured path is end-to-end tested.
- Data is per browser (IndexedDB). Clearing site data deletes it; there is no sync yet. Export to keep work.
- Palette is a pixel-frequency summary: small but important accents can be missed. Anti-aliasing produces small in-between swatches.
- SSIM is translation-sensitive; a small layout shift lowers it sharply. It is labelled as such.
- "Quiet area" is estimated and can't distinguish intended negative space from an unfinished area.
- Fonts, spacing tokens and radii can't be recovered from screenshots; styles take them as user input.
- SVG, HEIC and PDF uploads are not supported. Animated GIF/WebP are analysed on their first frame.
- The comparison difference map uses fit-contain letterboxing when formats differ; the grey bands are visible and labelled.
- `npm` prints a deprecation notice for ESLint 9 (see AGENTS.md → Dependencies for why it is kept).

## Next milestones

1. **Deploy the demo to Vercel** (Hobby, no AI key). The user approved a public demo; confirm once more before the final Deploy click.
2. **Independent code review** of `src/lib/image/validate.ts`, `src/lib/analysis/*`, `src/lib/color/*`,
   `src/app/api/review/route.ts`, `src/lib/ai/provider.ts` — concrete defects only, each verified with a failing test before fixing.
3. **Run AI review against a real key** (Anthropic or OpenAI-compatible) and add a recorded-response test fixture.
4. **Numbered anchors on the artwork** for findings with a location (detail centroid), plus an "Overall" group for whole-image findings.
5. Move analysis into a Web Worker for very large images; add a mobile E2E test for the Reference/Current toggle.
6. P2: website screenshot analysis, PPTX analysis, Supabase sync, team review, visual regression.
