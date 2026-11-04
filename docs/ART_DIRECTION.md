# FrameProof — Art direction

FrameProof is a review tool for people who make posters, slides, landing pages and brand pieces.
Its job is to put the artwork in front of the user and the decisions beside it.
The interface should be quieter than anything a user drops into it.

## Process

1. Studied the brief, the supplied references and the `motion-pptx-studio` skill (principles only;
   the repository carries no licence file, so no code was copied).
   Principles adopted from it: three *radically* different directions before building,
   an independent critic who did not build the work, "measure, never judge taste", and
   look-then-fix loops on real screenshots.
2. Wrote three directions (below).
3. Ran a review council: ChatGPT (Work mode, GPT-6.1) critiqued the directions as art director;
   Gemini 3.1 Pro reviewed the computer-vision and security plan. Claude (lead) accepted, amended
   or rejected each point. Notes at the end.
4. Selected one direction and locked tokens in `src/app/globals.css`.

### References studied

| Source | What was taken | What was rejected |
| --- | --- | --- |
| land-book.com | Gallery rhythm: artwork thumbnails kept at their own aspect ratio, captions on a shared baseline, filters as plain text | Card shadows on every tile |
| collectui.com | Category-first browsing; favourites as a lightweight save | — |
| pageflows.com | Flows shown as ordered steps with annotations beside each screen | Marketing-page testimonial blocks |
| fontinlogo.com | **Confidence vocabulary**: every match carries a status ("Verified", "Closest font", "Community suggestion"). FrameProof's *Measured / Estimated / AI-observed* labels come straight from this idea | Ad placements mixed into results |
| getlayers.ai | Studied as the counter-example: cinematic WebGL, glass, orbs, gradients | The whole aesthetic — it is what the brief forbids |
| collectui / land-book (direct fetch) | land-book and pageflows blocked automated fetches; they were viewed in a browser instead | — |

## Three directions

### A — Contact sheet
The photographer's proof sheet. Every artwork is a numbered frame on a hairline grid with
registration marks and mono captions; review happens by circling frames with a grease pencil.

```
+--------------------------------------------------------------+
| FrameProof   Projects  Library  Styles                        |
+--------------------------------------------------------------+
|  [01]      [02]      [03]      [04]      [05]                 |
|  ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐               |
|  │    │    │    │    │    │    │    │    │    │               |
|  └────┘    └────┘    └────┘    └────┘    └────┘               |
|  ref.png   v2.png    v3.png    ...                            |
+--------------------------------------------------------------+
```
Strength: superb for scanning many versions. Weakness: numbered frames and registration marks
turn into decoration when they appear everywhere, and a sheet is a poor place to write a long note.

### B — Galley proof  ← selected
The typesetter's galley: the artwork sits on the page with real margins, and the reviewer's
notes live in the outer margin beside it, numbered like proof marks in red pen. Folio lines carry
the project name and version.

```
+--------------------------------------------------------------+
| FrameProof          Desk   Analyzer   Library   Styles        |
+--------------------------------------------------------------+
| Event Poster — review 3                     folio: 2 images  |
|--------------------------------------------+-----------------|
|                                            | (1) Weak title  |
|      ┌──────────────┐  ┌──────────────┐    |     hierarchy   |
|      │  reference   │  │   current    │    | (2) Palette     |
|      │              │  │              │    |     drift       |
|      └──────────────┘  └──────────────┘    | (3) ...         |
|  side by side | slider | overlay | diff    |                 |
|--------------------------------------------+-----------------|
| Measurements (proof table, mono values)                       |
+--------------------------------------------------------------+
```
Strength: connects each observation to the evidence beside it; supports sustained daily review.
Weakness: margins can starve the artwork — mitigated by collapsing the margin under the stage
below 1100 px.

### C — Light table
A dark #252826 workspace where artwork floats on a lit surface and a tool rail runs down the side,
like a retoucher's station.

```
+--+-----------------------------------------------------------+
|▣ |                                                           |
|◐ |              ┌──────────────────┐                        |
|⌖ |              │     artwork      │                        |
|  |              └──────────────────┘                        |
|  |                                          [panel]          |
+--+-----------------------------------------------------------+
```
Strength: maximum focus and artwork area. Weakness: a dark surround shifts perceived contrast of
the artwork being judged, and floating panels hide the reasoning.

### Comparison

| | A Contact sheet | B Galley proof | C Light table |
| --- | --- | --- | --- |
| Composition | Grid, repetitive | Asymmetric spread, artwork + margin | Centre stage, floating chrome |
| Typography role | Mono captions dominate | Serif titles, sans reading, mono only for measured values | Minimal |
| Daily usability | Good for browsing, weak for review | Strong for review and decisions | Strong for inspection only |
| Identity | Distinct but decorative | Distinct and functional | Close to generic pro-tool dark UI |
| Colour judgement | Neutral | Neutral warm paper | Biased by dark surround |

**Decision: B, Galley proof**, with two borrowings:
the Library uses A's contact-sheet rhythm (thumbnails at their own aspect ratio on shared caption
baselines), and the dark workspace colour from C is used only behind the artwork stage in
*Overlay* and *Difference* modes, where a neutral dark helps read faint differences.

## Locked tokens

| Role | Value | Use |
| --- | --- | --- |
| Paper (canvas) | `#F6F4EF` | page background |
| Sheet (surface) | `#FFFFFF` | artwork stage, inputs |
| Ink | `#202323` | text |
| Graphite | `#6B6D66` | secondary text — darkened from the brief's `#777972` (4.01:1 on paper) to 4.77:1 so it passes WCAG AA |
| Rule | `#D8D5CE` | hairlines |
| Proof red | `#C65A42` | proof-mark circles, selection rules (non-text, 3.87:1 ≥ 3:1) |
| Proof red, text | `#B04A33` | red text and white-on-red buttons (4.93:1 on paper, 5.42:1 white on it) |
| Sage | `#5A7468` | resolved state — darkened from `#779084` (3.13:1) to 4.62:1 so text in it passes AA |
| Workspace | `#252826` | stage background in overlay/difference modes only |

Type: Lora (project titles, review summaries), Be Vietnam Pro (everything you read or click),
IBM Plex Mono (measured values only — hex codes, pixels, ratios — never for labels).
Scale (1.25 ratio from 15 px): 12 · 13 · 15 · 19 · 24 · 30 · 38.
Spacing: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 72.
Radius: 2 px for inputs and buttons, 0 for the artwork stage, 999 px only for the proof-mark circles.

## Rules the build follows

1. The artwork is the hero; chrome stays outside its bounds.
2. Proof red appears only where a decision is being made.
3. Numbers in proof marks mean priority order — a real sequence, not decoration.
4. Every finding states its evidence type: Measured, Estimated, or AI-observed.
5. No gradients, glass, glow, bento grids, emoji, fake statistics, or composite "design scores".
6. Sentence case everywhere; no tracked-out all-caps eyebrows; buttons say what they do.
7. Motion 120–200 ms ease-out, only for state changes; none when reduced motion is requested.

## Council notes (lead's verdicts)

ChatGPT, art direction:
- *B wins, A for collections, C as a viewing mode* — **accepted** (see decision).
- *Annotation margin 280–320 px, collapse to drawer when artwork gets small* — **accepted**, 320 px, collapses below the stage under 1100 px.
- *Instrument chrome outside the artwork; registration marks only when they communicate bounds* — **accepted**: corner marks appear only around the artwork stage to show its true bounds.
- *Never silently stretch one image; keep persistent reference/current labels; avoid a composite score* — **accepted**, all three are in the build.

Gemini, vision and security:
- *k-means in Oklab, k-means++ init, ~65k samples, SSIM on downscaled luminance, dHash/pHash, Sobel edge density* — **accepted** (seeded PRNG added so results are reproducible).
- *Edge density and centroid are "measured"; whitespace ratio and thirds energy only "estimated"* — **accepted**; thirds energy dropped as too noisy to be useful.
- *Magic-byte sniffing, 15 MB limit, pixel-count cap from the header before decoding* — **accepted**, cap set at 40 megapixels.
- *AI schema with a `measurements` block filled by the model (focal point, text overlap)* — **rejected**: a model cannot measure; anything it returns is labelled `ai-observed`. Measurements come only from deterministic code.
- *"Never load untrusted files into `<img>`"* — **amended**: headers are parsed and the pixel cap enforced first; decoding then uses `createImageBitmap`, which is safe once the bomb risk is removed.
