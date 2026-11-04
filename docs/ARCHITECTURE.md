# Architecture

## Principles

1. **Deterministic code for measurable facts; AI only for subjective interpretation.** The rule engine never guesses fonts, intent or semantic hierarchy.
2. **Local-first.** The app is fully functional with no backend and no account. The only server code is the optional AI route.
3. **Every claim carries its evidence type** (`measured` / `estimated` / `ai-observed`), and numbers carry their method.
4. **No silent failure.** Storage errors, decoding errors and AI failures are shown with what to do next; unsaved notes trigger a leave warning.

## Data flow

```
File ──► validate (magic bytes, 15 MB, header dims ≤ 40 MP)
     ──► createImageBitmap ──► canvas, 512 px working copy
     ──► analyzeBuffer (256 px): palette, frequency, structure ──► Asset {blob, thumb, analysis} ──► IndexedDB

Project {reference, current} ──► runLocalReview
     ──► compareBuffers (fit-contain on mid-grey, never stretched): SSIM, dHash, histogram, changed area
     ──► rule engine ──► ReviewIssue[] (sorted: priority → confidence → evidence)
     ──► Review v(n) ──► IndexedDB

(optional) Review ──► POST /api/review (multipart: images, brief, measured context)
     ──► server: re-validate, sharp re-encode 1280 px ──► provider ──► Zod-validated JSON (1 retry)
     ──► client: validate again ──► issues labelled ai-observed ──► Review updated
```

## Modules

| Module | Responsibility | Notes |
| --- | --- | --- |
| `lib/analysis/pixels` | RGBA buffer type, luma, area resampling, fit-contain, seeded PRNG | Environment-neutral, unit-tested in Node |
| `lib/analysis/palette` | k-means in Oklab, k-means++ seed 7, ΔE_OK < 0.03 merge; 64-bin RGB frequency | Transparent pixels (α < 128) excluded and reported |
| `lib/analysis/structure` | Mean luma, RMS contrast, Sobel edge density (threshold 0.25), detail centroid, 3×3 detail grid, quiet-cell share (estimated) | |
| `lib/analysis/similarity` | SSIM (8×8, stride 4), dHash 64-bit, histogram intersection, luma difference map | Comparison canvas at the reference's aspect, long side 256 |
| `lib/color` | sRGB ↔ linear ↔ Oklab; WCAG 2.x ratio with truncation for display | `4.499` displays as `4.49:1`, never as a pass |
| `lib/image/validate` | Sniff PNG/JPEG/GIF/WebP; parse IHDR, SOFn, GIF LSD, VP8/VP8L/VP8X headers | Shared by browser and server |
| `lib/review/engine` | 9 deterministic rules with explicit thresholds (`THRESHOLDS`) | Each issue: observation, recommendation, rationale, preserve, evidence |
| `lib/review/report` | Markdown revision brief, JSON export, style → CSS variables / JSON tokens | Markdown special characters escaped |
| `lib/ai` | `VisionProvider` interface; Anthropic Messages API and OpenAI-compatible chat completions via `fetch` | No SDK dependency; key never leaves the server |
| `lib/store` | IndexedDB (`projects`, `assets`, `reviews`, `references`, `styles`), repository functions, change events | Quota errors surface as readable messages |

## Review rules

| Rule | Category | Evidence | Fires when |
| --- | --- | --- | --- |
| Format differs | layout | measured | aspect ratios differ by > 2% |
| Palette drift | colour | measured | share-weighted mean ΔE_OK to the nearest current colour > 0.08 |
| Accent coverage | colour | measured | reference's most chromatic colour (≥ 2% share) changes coverage by > 2.5× or < 0.4× |
| New strong colour | consistency | measured | a colour with chroma ≥ 0.07 and ≥ 5% share has no reference match (ΔE > 0.12, or > 0.06 when the nearest match is neutral) |
| No pair reaches 4.5:1 | accessibility | measured | best contrast among colours with ≥ 5% share is < 4.5 |
| Flatter tonal range | hierarchy | measured | RMS contrast < 65% of the reference's and 0.05 lower |
| Busier / sparser | layout | measured | edge density differs by > 1.5× and > 3 points |
| Open space | layout | estimated | quiet-cell share differs by > 15 points |
| Centre of detail moved | hierarchy | measured | detail centroid moves > 12% of the frame |

## Migration path

- **Supabase:** `lib/store/repo.ts` is the only module the UI calls for persistence. A sync layer can implement the same functions against Supabase (Storage for blobs, Postgres for the rest) behind a feature flag.
- **Workers:** analysis functions are pure and take a `PixelBuffer`, so they can move into a Web Worker without changes.
- **More providers:** implement `VisionProvider` and add a case to `getProviderConfig`.

## Dependency decisions

- **Next.js 16.4, React 19.3, TypeScript 5.9, Tailwind CSS 4.3, Zod 4, sharp 0.35, Playwright 1.63, Vitest 5.**
- **ESLint 9, not 10:** `eslint-config-next` 16.4 supports ESLint 10, but `eslint-plugin-react`, `eslint-plugin-import` and `eslint-plugin-jsx-a11y` (which it bundles) don't list ESLint 10 as a peer yet, so `npm install` would fail strict peer resolution. npm prints a deprecation notice for ESLint 9; upgrade when those plugins catch up.
- **TypeScript 5.9, not 7:** the Go-native TypeScript 7 is not yet supported by `typescript-eslint`.
- **No UI kit:** Radix primitives (`Dialog`, `AlertDialog`) for accessible overlays; everything else is native elements styled with the token system in `globals.css`.
