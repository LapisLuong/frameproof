# QA report

Last verified: 4 Nov 2026, on Linux (Node 22, Chromium 1243) and macOS arm64 (Node 24/26).

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` (strict, `noUncheckedIndexedAccess`) | pass |
| `npm run lint` (eslint-config-next core-web-vitals + TypeScript) | pass, 0 warnings |
| `npm test` (Vitest) | 65 / 65 pass on `feat/github-pages` 3a6d6a4 (adds `tests/unit/store-validation.test.ts`: stored-record validation, token lines, recent-project order) — colour conversion, WCAG, palette, structure, similarity, aspect labels, upload validation (PNG/JPEG headers, bombs, fake files), review rules, AI config/validation/retry |
| `npm run build` | pass on Linux and macOS |
| `npm run test:e2e` (Playwright) | 18 / 18 pass in server mode and 17 / 17 (+1 skipped: the AI route) against the static export on `feat/github-pages` 3a6d6a4, 4 Nov 2026; the base-path test also passes against the `/frameproof` preview (`BASE_PATH=/frameproof PORT=3300`). Adds `tests/e2e/robustness.spec.ts` (draft guards, failed IndexedDB writes keep text, invalid token lines refused, discard link under the base path) and `tests/e2e/history.spec.ts` (an earlier review shows the pair it measured; unsaved notes ask before a version switch). Earlier: adds `tests/e2e/anchors.spec.ts` (marks at 1440 and 390 px, mark → note focus, resolve hides marks, layered modes) — full journey, fake-image rejection, library, analyzer → style → CSS, AI route unconfigured, keyboard skip link, sample project with no horizontal overflow at 1440 and 390 px, reduced motion |

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
| Numbered anchors on the artwork | Done (milestone 4) — the centre-of-detail note is marked on both images; whole-image notes say so |
| Sample current poster looks deliberately weak | Acknowledged; it is a teaching sample and is labelled "Sample" |

Gemini 3.1 Pro reviewed the computer-vision and security plan in round 1 (k-means in Oklab, SSIM/dHash parameters,
magic bytes and pixel caps were adopted; its proposal to let the model fill a "measurements" block was rejected).
In round 2 it could not open the GitHub links and said so rather than guessing; the in-browser hand-off of the source
failed (clipboard and CSP restrictions), so the **independent code review is still open** (milestone 2).

The fractional-overlap resampling fix (review finding F2) moves some measured values slightly on the sample pair:
SSIM 0.425 → 0.423, dHash distance 21 → 19 bits, changed area 43.6% → 43.5%. The new values are the correct area
averages; no finding appeared or disappeared.

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
- Numbered marks: only the centre-of-detail rule has a measured location, so at most one note is marked. Marks show
  in side by side only (layered modes letterbox the current image). A mark sits on the measured point and can cover a
  glyph there; zoom in or resolve the note to clear it.
- `npm` prints a deprecation notice for ESLint 9 (see AGENTS.md → Dependencies for why it is kept).

## Next milestones

1. **Hosted demo on GitHub Pages** — built and checked locally (`npm run build:static`, `.github/workflows/pages.yml`,
   preview at `/frameproof` passes Codex desktop's independent probe). Left: push `main`, then in the repo's
   Settings → Pages choose "GitHub Actions", and re-check the live URL https://lapisluong.github.io/frameproof/.
   Pages has no server, so AI review is off there and says why.
2. ~~Independent code review~~ — done by Codex, 4 findings (0 high, 2 medium, 2 low), all verified and fixed on
   `fix/review-findings`; see `docs/reviews/codex-review.md` on that branch. Original scope:  `src/lib/image/validate.ts`, `src/lib/analysis/*`, `src/lib/color/*`,
   `src/app/api/review/route.ts`, `src/lib/ai/provider.ts` — concrete defects only, each verified with a failing test before fixing.
3. **Run AI review against a real key** (free route: Gemini via its OpenAI-compatible endpoint, see `.env.example`) (Anthropic or OpenAI-compatible) and add a recorded-response test fixture.
4. ~~Numbered anchors on the artwork~~ — done on `feat/finding-anchors`. Notes stay in one priority-ordered list and are
   labelled "On the artwork" or "Whole image" (separate groups put a low-priority note above high ones).
5. Move analysis into a Web Worker for very large images; add a mobile E2E test for the Reference/Current toggle.
6. **Master-prompt audit** (`docs/reviews/codex-master-prompt-audit.md`): G1–G7, G9 and G10 are done
   (G1–G3, G5–G7 by Codex CLI, reviewed and fixed on merge; G4 and G9 by Claude Code: zoom and pan now follow the
   pointer directly, with no transform transition). Open: **G8** structured observations in the single-image analyzer
   (Low; needs plan mode, it touches the rule layer).
7. P2: website screenshot analysis, PPTX analysis, Supabase sync, team review, visual regression.
