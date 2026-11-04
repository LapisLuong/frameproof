# FrameProof — agent guide

Read this before changing anything. It applies to every coding agent (Codex, Claude Code, others).
`CLAUDE.md` imports this file; keep this one as the single source of truth.

## What this is

FrameProof is a creative-direction and visual-QA workspace (Next.js 16 App Router, React 19, TypeScript strict,
Tailwind 4, Zod 4, sharp). A designer pairs a reference image with their current design; the app measures both
**in the browser**, compares them, and produces prioritised, explained review notes and an exportable revision brief.
Data lives in IndexedDB. The only server code is the optional AI review route.

Read `docs/ART_DIRECTION.md` (why the UI looks the way it does), `docs/ARCHITECTURE.md` (modules, data flow, rules)
and `docs/QA.md` (test results, known limitations, next milestones).

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # must pass
npm run lint         # must pass (ESLint 9 flat config; see "Dependencies")
npm test             # Vitest unit tests — must pass
npm run build        # must pass
npx playwright install chromium   # once
npm run test:e2e     # builds are served with `next start -p 3100`; run `npm run build` first
node scripts/qa-screens.mjs http://localhost:3100 qa/screenshots   # visual QA captures (server must be running)
```

Definition of done for any change: typecheck, lint, unit tests, build and e2e all pass, and you looked at the
affected screens (run `qa-screens.mjs` and open the PNGs) at 1440, 1024 and 390 px.

## Non-negotiable product rules

1. **Never fabricate analysis.** Measured values come only from deterministic code in `src/lib/analysis` and
   `src/lib/color`. If something can't be measured from pixels (font family, CSS spacing, reading order, intent,
   quality), don't present it as measured.
2. **Every finding carries an evidence type**: `measured`, `estimated` (computed but interpretation relies on an
   assumption), or `ai-observed` (vision model). AI output is always `ai-observed`; never let a model fill a
   "measurements" field.
3. **No composite design score.** Prefer explainable findings: observation, why it matters, what to change, what to keep.
4. **AI is optional and server-side only.** Keys come from env vars read in `src/app/api/review/route.ts` /
   `src/lib/ai/provider.ts`. Never import `src/lib/ai/provider.ts` from client code. When unconfigured, say so; never
   simulate a result. Model output is Zod-validated on the server and again on the client.
5. **User images stay in the browser** (IndexedDB) unless the user explicitly runs AI review. Never store images in
   localStorage. Never upload user content anywhere else.
6. **Uploads are validated before decoding**: magic bytes (PNG/JPEG/WebP/GIF), 15 MB, header dimensions ≤ 40 MP.
7. **No silent data loss.** Destructive actions use `ConfirmDialog`; unsaved text warns on unload.
8. **Library links are stored as links only** — no scraping. Only `http(s)` URLs are rendered as links.

## Design rules (see docs/ART_DIRECTION.md)

Direction "Galley proof": artwork is the hero, decisions sit in the margin like proof marks.
- Tokens live in `src/app/globals.css` (`@theme`). Use them; don't introduce new colours casually.
- Proof red `#C65A42` only for proof marks and selection rules; red **text** uses `#B04A33` (AA). Sage `#5A7468` = resolved.
- Type: Lora for titles, Be Vietnam Pro for everything read or clicked, IBM Plex Mono **only for measured values**.
  Fonts are self-hosted in `src/app/fonts` (OFL) — no Google Fonts requests.
- Forbidden: gradients, glassmorphism, glow, bento grids, emoji UI, giant rounded cards, fake stats, chatbot boxes,
  tracked all-caps eyebrows, decorative animation. Motion 120–200 ms ease-out for state changes only; respect
  `prefers-reduced-motion`.
- Copy: sentence case, plain verbs, buttons say what they do ("Mark resolved", "Export revision brief").
- Vietnamese diacritics must render correctly (the sample posters exercise this).

## Code map

- `src/lib/analysis` — pixel buffers, palette (k-means in Oklab, seeded), structure (Sobel), similarity (SSIM, dHash).
  Pure functions on `PixelBuffer`; unit-tested in Node. Keep them environment-neutral.
- `src/lib/review/engine.ts` — deterministic rules; thresholds in `THRESHOLDS`. Add a unit test with every new rule.
- `src/lib/review/report.ts` — Markdown/JSON review export, style → CSS/JSON tokens.
- `src/lib/store` — IndexedDB wrapper (`db.ts`), models, repository (`repo.ts`). UI talks only to `repo.ts`
  (this is the seam for a future Supabase sync).
- `src/lib/ai` — provider abstraction (Anthropic Messages API, OpenAI-compatible chat completions via `fetch`).
- `src/components` — CompareStage (side/slider/overlay/difference), ImageViewer (zoom/pan), ProofNotes, Measurements.
- `src/app` — routes: `/` Desk, `/projects/[id]` review, `/analyze`, `/library`, `/styles`, `/api/review`.
- `tests/unit` (Vitest), `tests/e2e` (Playwright), `scripts/` (sample posters, QA screenshots).

## Dependencies

Pinned on purpose — don't upgrade blindly:
- ESLint stays on 9: `eslint-config-next` 16.4 bundles plugins (react, import, jsx-a11y) whose peers stop at ESLint 9.
- TypeScript stays on 5.9: `typescript-eslint` doesn't support the Go-native TypeScript 7 yet.
- `@playwright/test` is pinned to 1.63.0.

## Git

- Default branch `main` on https://github.com/LapisLuong/frameproof (public). Work on a branch, small logical commits.
- Commit author must be the GitHub no-reply address (`177215296+LapisLuong@users.noreply.github.com`), never a
  personal email. Never commit `.env*` (except `.env.example`), API keys, or user data.
- Don't force-push `main`.

## Working as a pair (Claude Code + Codex)

Suggested split that worked during the build: one agent implements, the other reviews independently without having
seen the implementation discussion. The reviewer reports concrete defects only (file, failing input, fix), and the
implementer verifies each before changing code. Record decisions in `docs/` rather than in chat.

## Open work (priority order)

See `docs/QA.md` → "Next milestones". The top items: deploy the demo to Vercel (no AI key), an independent code review
of `src/lib/image/validate.ts`, `src/lib/analysis/*` and `src/app/api/review/route.ts`, and numbered anchors on the
artwork for findings that have a location.
