# Workspace UI and accessibility patch (Codex desktop), reviewed by Claude Code

4 November 2026. Author: Codex desktop (branch `codex/review-workspace-accessibility`, base 7a27eb8).
Independent review and rebase onto `main` 0ce4779: Claude Code, on `review/codex-desktop-ui`.

## What the patch changes

| Area | Change | File |
| --- | --- | --- |
| Analyzer | `Result` keyed by `asset.id`, so switching images resets the contrast picker instead of keeping colours from the previous palette. Upload/recent grid uses `minmax(min(100%, 18rem), 1fr)` below 320 px. | `src/app/analyze/Analyzer.tsx` |
| Measurements | The horizontally scrolling table is a named, focusable region (`role="region"`, `tabIndex=0`), so keyboard users can scroll it. | `src/components/Measurements.tsx`, `src/app/globals.css` |
| Mobile file rows | Below 640 px the reference/current rows become a grid: filename on its own line, dimensions beside Replace. | `src/app/globals.css` |
| Mobile controls | `.modes` buttons and `.btn-sm` get a 44 px minimum height below 640 px; `.modes` wraps. | `src/app/globals.css` |
| Artwork stage | `touch-action: pan-y pinch-zoom` (was `none`), so a gesture starting on the artwork can scroll the page and pinch-zoom. Pointer cancel and lost capture end a drag. Pointer-down and key events from nested controls no longer drive the stage. | `src/app/globals.css`, `src/components/useZoomPan.ts` |
| Tests | E2E: analyzer image switch resets contrast; sample project's measurement region is focusable and scrolls locally; on 390 px the file row is a grid and the Reference/Current toggle swaps the image. | `tests/e2e/journey.spec.ts` |

## Review against `main` 0ce4779

**Verdict:** no concrete defects.

**Overlap.** The patch's style-save wait (`toBeDisabled()` before reload) duplicates 085d1d0 on main, which waits
for the "Saved" text. The hunk was rejected on apply and is omitted, by agreement. Both waits are valid:
`src/app/styles/Styles.tsx` clears `dirty` only after `await saveStyle(...)`.

**Interaction with numbered artwork marks** (added on main after the patch's base). The marks are buttons inside
the stage, so the new `useZoomPan` guards apply to them:
- Pointer-down guard (`closest("button, input, select, textarea, a")`): mark buttons already stop propagation on
  pointer-down; the guard is redundant for them and the right general fix.
- Key guard (`e.target !== e.currentTarget`): arrow and +/− keys on a focused mark no longer pan or zoom the stage.
  Enter and Space still activate the mark. An improvement.
- `touch-action: pan-y pinch-zoom`: marks remain tappable. Vertical touch-pan of a zoomed image is no longer
  available; keyboard arrows still pan. Accepted trade-off, documented by the author.

**Formatting.** Prettier reformatted the new CSS block and one E2E line; no behaviour change.

## Validation (Claude Code, canonical checkout, `next start -p 3100`)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npx vitest run` | 55 / 55 |
| `npm run build` | pass |
| `npx playwright test` | 13 / 13 (desktop 1440 + mobile 390), including the new analyzer test and the numbered-marks tests |
| `node scripts/qa-screens.mjs` | no page errors; project screen inspected at 390 px: filename rows read on one line, controls 44 px, marks intact |

Author's own validation on base 7a27eb8: typecheck, lint, 37 unit, build, 10 E2E, screenshots at 1440/1024/390.

## Not covered

Screen readers, physical touch hardware (emulated touch only), browser text zoom, and non-Chromium engines.

## Non-blocking suggestions

1. The measurement region's accessible name says "scroll horizontally for all columns" at every width, but at
   1440 px nothing scrolls and the region is still a tab stop. Consider naming it "Measurements" and adding the
   hint only when `scrollWidth > clientWidth`.
2. A visible scroll hint for the table on mobile (from the author's follow-ups).
