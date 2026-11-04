# Independent master-prompt feature audit

| Gap | User impact | Requirements | Finding | Evidence | Minimal fix | Size |
| --- | --- | --- | --- | --- | --- | --- |
| G1 | High | K | Unsaved drafts disappear on internal navigation/version selection/dialog dismissal | src/app/projects/[id]/ProjectWorkspace.tsx:259,557; src/app/styles/Styles.tsx:385; src/app/library/Library.tsx:325 | Guard internal transitions and dismissal, or persist drafts; warn before discarding project/library/style/review text. | M |
| G2 | High | K, N | Storage failures leave misleading loading states or unhandled mutation rejections | src/app/styles/Styles.tsx:71,347,357; src/app/analyze/Analyzer.tsx:156; src/app/projects/[id]/ProjectWorkspace.tsx:386; src/components/ConfirmDialog.tsx:36 | Render loader errors and await/catch every write/delete, keeping text and dialogs open on failure. | M |
| G3 | High | K, N | Malformed persisted records can crash a workspace | src/lib/store/db.ts:61,66; src/app/styles/Styles.tsx:123 | Validate local records at repository reads, preserve invalid data and expose recovery/export rather than blindly rendering it. | M |
| G4 | Medium | D | Review history cannot display the image pair it reviewed | src/app/projects/[id]/ProjectWorkspace.tsx:33,469,514; src/lib/store/repo.ts:97 | Display assets addressed by selected review.referenceAssetId/currentAssetId in historical mode. | M |
| G5 | Medium | K | Invalid spacing/radius lines are silently removed from saved styles | src/app/styles/Styles.tsx:21,63,75,251 | Reject invalid lines with line-level errors and keep the complete draft until the user corrects it. | M |
| G6 | Medium | E | Style references are stored IDs/title checkboxes, without usable image access | src/app/styles/Styles.tsx:254; src/app/analyze/Analyzer.tsx:61 | Render source/linked image thumbnails with links to their saved reference/analyzer. | M |
| G7 | Low | A | Project list tracks edits, not recent opens | src/lib/store/repo.ts:51,55; src/lib/store/models.ts:21 | Persist lastOpenedAt when opening a project; sort recent projects by it. | S |
| G8 | Low | C | Single-image analyzer has metrics but no structured observations | src/app/analyze/Analyzer.tsx:68; src/components/Measurements.tsx:112 | Add deterministic single-image observations with evidence and export them; do not invent semantic claims. | M |
| G9 | Low | I | Zoom transform motion uses 60 ms linear rather than requested timing/easing | src/components/ImageViewer.tsx:59; src/components/CompareStage.tsx:78 | Use direct manipulation without transitions; apply shared 160 ms ease-out for discrete zoom state changes. | S |
| G10 | Low | M | README clone URL is still a placeholder | README.md:32 | Use the actual public repository URL in the install command. | S |

## Fixes — 4 November 2026

### G1
Fixed: Styles, Library add/edit and Desk new-project drafts now confirm internal link navigation and browser Back with ConfirmDialog; Library also confirms Cancel, Escape and outside dismissal. Browser unload remains guarded. New-style and sample-project actions use the same guard. Project review-note handling belongs to Claude's parallel work.

### G2
Fixed: Style creation/save/export validation and analyzer palette saves show readable failures. ConfirmDialog awaits asynchronous confirmations, prevents repeat submission and dismissal while pending, and retains the dialog with an error on rejection. Library and Desk retain their drafts after failed writes. Loader errors are visible in Styles and Analyzer; aborted deletes reject.

### G3
Fixed: Repository single/list/index reads validate all five record types with Zod, including nested analysis and the existing ReviewIssueSchema. Lists skip invalid records and announce the skipped count; records remain in IndexedDB. Single-record reads return unavailable rather than malformed data. No automatic deletion or migration occurs.

### G5
Fixed: Spacing/radius parsing rejects malformed nonblank lines with the field name and original line number. Save and export retain the complete editor draft on validation failure.

### G6
Fixed: Styles render linked image-reference and source-image thumbnails that open the saved asset in the analyzer; linked URL references expose an http(s) original link. Missing linked assets are explained.

### G7
Fixed: Project records accept optional lastOpenedAt, markProjectOpened(id) persists it without changing updatedAt, and Desk's repository list sorts by lastOpenedAt ?? updatedAt. Claude must call markProjectOpened from ProjectWorkspace and handle write failures there.

Validation: added 10 unit cases in tests/unit/store-validation.test.ts and three browser regression journeys in tests/e2e/robustness.spec.ts. Typecheck, lint and Vitest run in this sandbox; browser tests and visual captures are delegated to Claude because this task cannot bind a server port. Original audit counts below describe the pre-fix assessment.

## Scope and assessment

Audited 4 November 2026 in the supplied checkout (revision 75dc6d5 as identified by the task; no Git command used). Read AGENTS.md, README.md and docs/QA.md first, then ART_DIRECTION.md, ARCHITECTURE.md, source modules and both test suites. Only this report was written. No installation, build, server, test run or new screenshot capture was performed because those can create files beyond the authorized report. Test names below are inspected test evidence, not a claim of a fresh passing run. Existing QA results and screenshot artifacts supply delivery/runtime evidence.

“Done” means a reachable implementation exists in the UI and its repository path persists data where required, supported by source and available tests; it does not certify every browser/error state. “Partial” identifies a concrete incomplete behavior. Estimates: S < 1 hour; M < half a day; L longer. Gap estimates are shared across repeated checklist rows, not additive. Findings are source-traced, not freshly browser-reproduced.

**Counts: 115 done, 10 partial, 0 missing, 0 not-applicable across 125 atomic checklist rows; 10 unique gap groups.** Repeated journey/definition-of-done requirements are intentionally counted separately.

Interpretation: user-entered typography/motion recommendations satisfy the style record requirement; automatic generation was not requested. Slider wipe satisfies before/after. Recommendations provide suggested design actions; no unsupplied original interface was assumed. Palette shares satisfy colour frequency without demanding another histogram. P2 website/PPTX analysis, sync, teams and visual regression are excluded; hosting is not required by A–N and is explicitly on hold in QA. Live-provider validation remains a documented verification limitation, not a missing optional-AI feature.

## Full checklist

### A. Home

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Recently opened projects | partial | src/lib/store/repo.ts:51; src/lib/store/repo.ts:55; src/lib/store/models.ts:21 | Desk sorts by updatedAt; simply opening an old project never changes its order. | G7: Persist lastOpenedAt on opening a project and sort the recent list by it (S). |
| New project action | done | src/app/Desk.tsx:27; src/lib/store/repo.ts:57 | UI/module and persistence path present where applicable. | — |
| Recent analyses | done | src/app/Desk.tsx:23; src/app/Desk.tsx:250 | UI/module and persistence path present where applicable. | — |
| Saved styles | done | src/app/Desk.tsx:280; src/lib/store/repo.ts:209 | UI/module and persistence path present where applicable. | — |
| Meaningful empty states | done | src/app/Desk.tsx:146; src/app/Desk.tsx:212 | UI/module and persistence path present where applicable. | — |
| Continue previous work | done | src/app/Desk.tsx:174; src/app/projects/[id]/ProjectWorkspace.tsx:33 | UI/module and persistence path present where applicable. | — |
| No fake statistics | done | src/app/Desk.tsx:143; src/app/Desk.tsx:169; src/app/Desk.tsx:241 | UI/module and persistence path present where applicable. | — |

### B. Inspiration Library

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Save a reference URL | done | src/app/library/Library.tsx:53; src/lib/store/repo.ts:184 | UI/module and persistence path present where applicable. | — |
| Upload a reference image | done | src/app/library/Library.tsx:59; src/app/library/Library.tsx:135; src/lib/store/repo.ts:24 | UI/module and persistence path present where applicable. | — |
| Assign tags | done | src/app/library/Library.tsx:126; src/lib/store/repo.ts:191 | UI/module and persistence path present where applicable. | — |
| Create collections | done | src/app/library/Library.tsx:109; src/app/library/Library.tsx:234; src/lib/store/repo.ts:195 | Collections are persisted names on entries, selectable by filter; independent empty collection objects are not required. | — |
| Search by title or tag | done | src/app/library/Library.tsx:235 | UI/module and persistence path present where applicable. | — |
| Filter by Typography, Layout, Color, Motion, Editorial, Branding, Web, Presentation | done | src/lib/store/models.ts:52; src/app/library/Library.tsx:274 | UI/module and persistence path present where applicable. | — |
| Open saved references | done | src/app/library/Library.tsx:164; src/app/library/Library.tsx:181; src/app/library/Library.tsx:210; src/app/library/Library.tsx:301 | UI/module and persistence path present where applicable. | — |
| Remove an entry | done | src/app/library/Library.tsx:195; src/lib/store/repo.ts:200 | UI/module and persistence path present where applicable. | — |
| Edit an entry | done | src/app/library/Library.tsx:215; src/app/library/Library.tsx:333; src/lib/store/repo.ts:184 | UI/module and persistence path present where applicable. | — |
| Store source attribution | done | src/app/library/Library.tsx:64; src/app/library/Library.tsx:89; src/app/library/Library.tsx:180 | UI/module and persistence path present where applicable. | — |
| No scraping | done | src/app/library/Library.tsx:53; src/app/library/Library.tsx:86; src/lib/store/repo.ts:184 | UI/module and persistence path present where applicable. | — |

### C. Visual Analyzer

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Two columns: artwork left, analysis right | done | src/app/analyze/Analyzer.tsx:72 | Desktop has artwork + measurement table on the left, palette/contrast on the right; narrow screens stack. | — |
| Upload | done | src/app/analyze/Analyzer.tsx:142; src/app/analyze/Analyzer.tsx:183 | UI/module and persistence path present where applicable. | — |
| Drag and drop | done | src/components/Dropzone.tsx:34 | UI/module and persistence path present where applicable. | — |
| Zoom | done | src/components/ImageViewer.tsx:37; src/components/useZoomPan.ts:27 | UI/module and persistence path present where applicable. | — |
| Pan | done | src/components/useZoomPan.ts:43 | UI/module and persistence path present where applicable. | — |
| Fit | done | src/components/ImageViewer.tsx:108; src/components/useZoomPan.ts:84 | UI/module and persistence path present where applicable. | — |
| Palette extraction | done | src/app/analyze/Analyzer.tsx:82; src/lib/analysis/palette.ts:31 | UI/module and persistence path present where applicable. | — |
| Colour frequency | done | src/components/Measurements.tsx:12; src/lib/analysis/palette.ts:145 | Palette shares and bars expose frequency in the UI; the separate coarse frequency bins are also in JSON. A second histogram UI is not explicitly required. | — |
| Dimensions | done | src/components/Measurements.tsx:117; src/lib/image/decode.ts:74 | UI/module and persistence path present where applicable. | — |
| Aspect ratio | done | src/components/Measurements.tsx:118; src/lib/analysis/analyze.ts:44 | UI/module and persistence path present where applicable. | — |
| Measurable contrast for selected pairs | done | src/app/analyze/Analyzer.tsx:84; src/components/Measurements.tsx:44; src/lib/color/contrast.ts:24 | Selected pairs are extracted palette colours. | — |
| Exportable analysis | done | src/app/analyze/Analyzer.tsx:18; src/app/analyze/Analyzer.tsx:99 | Markdown/JSON downloads, with analysis saved as an asset. | — |
| No invented fonts or geometry | done | src/components/Measurements.tsx:215; src/components/Measurements.tsx:234; src/lib/analysis/structure.ts:39 | UI/module and persistence path present where applicable. | — |
| Estimates labelled | done | src/components/Measurements.tsx:124; src/app/analyze/Analyzer.tsx:39 | UI/module and persistence path present where applicable. | — |
| Structured observations | partial | src/app/analyze/Analyzer.tsx:68; src/components/Measurements.tsx:112 | Analyzer shows structured metrics and method explanations, but no image-specific observation/recommendation list; ProofNotes is only in projects. | G8: Derive a small explicitly evidenced single-image observation list and include it in analysis exports (M). |

### D. Design Review

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Two images | done | src/app/projects/[id]/ProjectWorkspace.tsx:531; src/app/projects/[id]/ProjectWorkspace.tsx:514 | UI/module and persistence path present where applicable. | — |
| Side by side | done | src/components/CompareStage.tsx:276 | UI/module and persistence path present where applicable. | — |
| Before/after | done | src/components/CompareStage.tsx:230; src/components/CompareStage.tsx:98 | Slider wipe supplies before/after comparison of the two uploaded images. | — |
| Overlay | done | src/components/CompareStage.tsx:300; src/components/CompareStage.tsx:98 | UI/module and persistence path present where applicable. | — |
| Opacity slider | done | src/components/CompareStage.tsx:244 | UI/module and persistence path present where applicable. | — |
| Zoom sync | done | src/components/CompareStage.tsx:159; src/components/CompareStage.tsx:283; src/components/useZoomPan.ts:15 | UI/module and persistence path present where applicable. | — |
| Critique | done | src/app/projects/[id]/ProjectWorkspace.tsx:318; src/lib/review/engine.ts:81 | UI/module and persistence path present where applicable. | — |
| Specific recommended changes | done | src/components/ProofNotes.tsx:88; src/lib/review/engine.ts:123 | UI/module and persistence path present where applicable. | — |
| Review history | partial | src/app/projects/[id]/ProjectWorkspace.tsx:259; src/app/projects/[id]/ProjectWorkspace.tsx:270; src/app/projects/[id]/ProjectWorkspace.tsx:514; src/lib/store/repo.ts:97 | Versions persist and old measurements/notes load, but the stage always receives the latest project assets even when selecting an earlier version. Earlier blobs are retained but cannot be viewed with their review. | G4: Load the selected review’s asset IDs into a historical comparison stage, keeping current upload slots separate (M). |

### E. Style Library

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Palette | done | src/app/styles/Styles.tsx:103; src/lib/store/repo.ts:214 | UI/module and persistence path present where applicable. | — |
| Typography recommendations | done | src/app/styles/Styles.tsx:176; src/app/styles/Styles.tsx:194; src/lib/store/repo.ts:214 | User-authored type choices and recommendation notes persist; automatic typeface recognition/recommendation is not required. | — |
| Layout principles | done | src/app/styles/Styles.tsx:210; src/app/styles/Styles.tsx:63; src/lib/store/repo.ts:214 | UI/module and persistence path present where applicable. | — |
| Spacing tokens | done | src/app/styles/Styles.tsx:230; src/app/styles/Styles.tsx:63 | Valid tokens persist; see K for silent rejection of invalid lines. | — |
| Radius tokens | done | src/app/styles/Styles.tsx:240; src/app/styles/Styles.tsx:63 | Valid tokens persist; see K for silent rejection of invalid lines. | — |
| Motion recommendations | done | src/app/styles/Styles.tsx:220; src/app/styles/Styles.tsx:63; src/lib/store/repo.ts:214 | User-authored motion recommendations persist; no automatic generator is specified. | — |
| Design notes | done | src/app/styles/Styles.tsx:289; src/lib/store/repo.ts:214 | UI/module and persistence path present where applicable. | — |
| Export JSON | done | src/app/styles/Styles.tsx:307; src/lib/review/report.ts:135 | UI/module and persistence path present where applicable. | — |
| Export CSS variables | done | src/app/styles/Styles.tsx:310; src/lib/review/report.ts:123 | UI/module and persistence path present where applicable. | — |
| Estimates labelled | done | src/app/styles/Styles.tsx:107; src/app/styles/Styles.tsx:146; src/app/styles/Styles.tsx:180; src/lib/review/report.ts:147 | No inferred font/spacing/radius values are presented; measured/manual origins and user-set typography are explicit. | — |
| Reference images | partial | src/app/styles/Styles.tsx:254; src/app/styles/Styles.tsx:270; src/app/analyze/Analyzer.tsx:61 | Styles persist referenceIds and sourceAssetId, but the editor renders only library titles as checkboxes; neither linked images nor the source image can be viewed/opened from the style. | G6: Resolve linked/source assets and render thumbnail links to library detail or analyzer (M). |

### F. Journey

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Create project “Event Poster” | done | src/app/Desk.tsx:45; tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export | UI/module and persistence path present where applicable. | — |
| Upload reference and current | done | src/app/projects/[id]/ProjectWorkspace.tsx:531; src/lib/store/repo.ts:98 | UI/module and persistence path present where applicable. | — |
| Measured info | done | src/app/projects/[id]/ProjectWorkspace.tsx:536; src/lib/store/repo.ts:123 | UI/module and persistence path present where applicable. | — |
| AI if configured | done | src/app/projects/[id]/ProjectWorkspace.tsx:286; src/app/projects/[id]/ProjectWorkspace.tsx:163; src/app/api/review/route.ts:40 | UI/module and persistence path present where applicable. | — |
| Feedback by priority | done | src/lib/review/types.ts:71; src/components/ProofNotes.tsx:68 | UI/module and persistence path present where applicable. | — |
| Issue/title | done | src/components/ProofNotes.tsx:64; src/lib/review/types.ts:22 | UI/module and persistence path present where applicable. | — |
| Observation | done | src/components/ProofNotes.tsx:74 | UI/module and persistence path present where applicable. | — |
| Recommendation | done | src/components/ProofNotes.tsx:88 | UI/module and persistence path present where applicable. | — |
| Reason | done | src/components/ProofNotes.tsx:84 | UI/module and persistence path present where applicable. | — |
| Confidence | done | src/components/ProofNotes.tsx:80 | UI/module and persistence path present where applicable. | — |
| Suggested action | done | src/components/ProofNotes.tsx:88; src/components/ProofNotes.tsx:115 | Recommendation supplies the suggested design action; resolve/reopen supplies the workflow action. No separate duplicate suggestedAction field was supplied in this audit prompt. | — |
| What to preserve | done | src/components/ProofNotes.tsx:92; src/lib/review/engine.ts:95 | UI/module and persistence path present where applicable. | — |
| Save review | done | src/app/projects/[id]/ProjectWorkspace.tsx:422; src/lib/store/repo.ts:139 | UI/module and persistence path present where applicable. | — |
| Mark resolved | done | src/app/projects/[id]/ProjectWorkspace.tsx:212; src/lib/store/repo.ts:155 | UI/module and persistence path present where applicable. | — |
| Export revision brief | done | src/app/projects/[id]/ProjectWorkspace.tsx:246; src/lib/review/report.ts:30 | UI/module and persistence path present where applicable. | — |

### G. AI

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Optional | done | src/app/projects/[id]/ProjectWorkspace.tsx:286; src/app/api/review/route.ts:42 | UI/module and persistence path present where applicable. | — |
| Server-side | done | src/app/api/review/route.ts:3 | UI/module and persistence path present where applicable. | — |
| Keys never in browser | done | src/lib/ai/provider.ts:123; src/app/api/review/route.ts:13 | Only the API route imports provider.ts in application source; GET returns provider/model/reason only. | — |
| Strict schema | done | src/lib/ai/schema.ts:8; src/lib/ai/schema.ts:19 | Bounded typed fields/enums; unknown properties are stripped by Zod, not rejected. No model measurements enter the review. | — |
| Validated output | done | src/lib/ai/provider.ts:158; src/app/projects/[id]/ProjectWorkspace.tsx:196 | Server and client both validate. | — |
| Retry | done | src/lib/ai/provider.ts:153; tests/unit/ai.test.ts — retries once on malformed output, then succeeds | UI/module and persistence path present where applicable. | — |
| Graceful failure | done | src/app/api/review/route.ts:102; src/app/projects/[id]/ProjectWorkspace.tsx:189; src/app/projects/[id]/ProjectWorkspace.tsx:205 | Local findings survive; unconfigured route is E2E-tested. Actual provider requests were not executed during this audit. | — |
| Never fabricated | done | src/lib/ai/provider.ts:158; tests/unit/ai.test.ts — fails after two invalid answers instead of inventing a review | UI/module and persistence path present where applicable. | — |
| Observations distinguished from measurements | done | src/lib/ai/schema.ts:36; src/lib/store/models.ts:46 | UI/module and persistence path present where applicable. | — |

### H. Engine modules

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Image processing module | done | src/lib/image/decode.ts:58; src/lib/analysis/pixels.ts:65 | UI/module and persistence path present where applicable. | — |
| Palette module | done | src/lib/analysis/palette.ts:31 | UI/module and persistence path present where applicable. | — |
| Contrast module | done | src/lib/color/contrast.ts:4 | UI/module and persistence path present where applicable. | — |
| Similarity module | done | src/lib/analysis/similarity.ts:99 | UI/module and persistence path present where applicable. | — |
| AI observations module | done | src/lib/ai/schema.ts:36; src/lib/ai/provider.ts:145 | UI/module and persistence path present where applicable. | — |
| Prioritisation module | done | src/lib/review/types.ts:71; src/lib/review/engine.ts:317 | UI/module and persistence path present where applicable. | — |
| Report module | done | src/lib/review/report.ts:30 | UI/module and persistence path present where applicable. | — |
| ReviewIssue fields as specified | done | src/lib/review/types.ts:19; src/components/ProofNotes.tsx:64 | All fields named in F are represented semantically. The audit request provides no additional original interface to compare for exact property spelling. | — |
| No arbitrary scores | done | src/components/Measurements.tsx:227; src/lib/review/report.ts:88 | UI/module and persistence path present where applicable. | — |

### I. Motion

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| Motion 120–240 ms | partial | src/app/globals.css:38; src/components/ImageViewer.tsx:59; src/components/CompareStage.tsx:78 | Most state transitions use 160 ms; both image transforms hard-code 60 ms. | G9: Remove smoothing for direct manipulation, or use the shared duration for discrete zoom state changes (S). |
| Ease-out motion | partial | src/app/globals.css:32; src/components/ImageViewer.tsx:59; src/components/CompareStage.tsx:78 | Both image transform transitions use linear easing. | G9: Use the shared ease-out token for discrete animated zoom changes (S, shared fix). |
| Reduced motion respected | done | src/app/globals.css:42; tests/e2e/journey.spec.ts — reduced motion disables transitions | The global !important override also disables inline transform transitions; programmatic scrolling checks the media query. | — |
| No decorative animation | done | src/app/globals.css:911; src/app/globals.css:949; src/app/globals.css:994 | Dialog/toast entry and real-operation indeterminate busy line are functional state feedback, not fabricated percentage progress. | — |

### J. Persistence

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| IndexedDB for blobs | done | src/lib/store/db.ts:11; src/lib/store/repo.ts:24 | UI/module and persistence path present where applicable. | — |
| localStorage only for small preferences | done | src/lib/store/db.ts:4 | No localStorage API usage exists in src; absence of preference storage does not violate this restriction. | — |
| No images in localStorage | done | src/lib/store/repo.ts:35; src/lib/store/db.ts:76 | UI/module and persistence path present where applicable. | — |

### K. Security and data integrity

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| MIME and content validation | done | src/lib/image/validate.ts:24; src/lib/image/decode.ts:58; src/app/api/review/route.ts:20 | Content-derived MIME is authoritative, not the untrusted declared MIME. Decode verifies that header-valid content is actually readable. | — |
| Size limits | done | src/lib/image/validate.ts:7; src/lib/image/validate.ts:92; src/app/api/review/route.ts:44 | UI/module and persistence path present where applicable. | — |
| Sanitised user content | done | src/app/library/Library.tsx:16; src/app/library/Library.tsx:183; src/lib/review/report.ts:9; src/app/styles/Styles.tsx:27 | React text rendering escapes user strings; http(s) links and token-value restrictions avoid executable content. | — |
| No client secrets | done | src/lib/ai/provider.ts:123; src/app/api/review/route.ts:13 | UI/module and persistence path present where applicable. | — |
| Malformed API output handled | done | src/app/projects/[id]/ProjectWorkspace.tsx:188; src/app/projects/[id]/ProjectWorkspace.tsx:196; src/lib/ai/provider.ts:158 | UI/module and persistence path present where applicable. | — |
| Missing/corrupted local data handled | partial | src/lib/store/db.ts:61; src/hooks/useStore.ts:18; src/app/styles/Styles.tsx:357; src/app/analyze/Analyzer.tsx:156; src/app/projects/[id]/ProjectWorkspace.tsx:453 | Missing IDs and many loader failures are handled, but records are cast without runtime validation. A style with palette:null reaches s.palette.map and crashes; a storage read failure in Styles is displayed forever as “Opening styles…”, and Analyzer suppresses its loader error. | G2/G3: Validate stored records, isolate corrupt entries with recovery messaging, and render loader errors in Styles/Analyzer (M). |
| Never silently discard changes | partial | src/app/projects/[id]/ProjectWorkspace.tsx:239; src/app/projects/[id]/ProjectWorkspace.tsx:259; src/app/projects/[id]/ProjectWorkspace.tsx:557; src/app/styles/Styles.tsx:81; src/app/library/Library.tsx:325; src/app/styles/Styles.tsx:21 | beforeunload only covers full document unload; internal navigation/version/style selection remounts discard drafts. Library dialog dismissal has no dirty guard. Invalid spacing/radius lines are silently filtered, and saves/deletes have incomplete async error handling. | G1/G2/G5: Guard every draft-discard path, await/catch mutations, and validate token lines before saving (M for each independent fix). |

### L. Quality

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| No dead controls | done | src/components/CompareStage.tsx:208; src/components/ProofNotes.tsx:115; src/app/library/Library.tsx:252; src/app/styles/Styles.tsx:299 | Controls have handlers and legitimate unavailable states; error-path failures are recorded under K/N. | — |
| No fake progress | done | src/components/Dropzone.tsx:45; src/app/globals.css:994 | Indeterminate busy feedback tracks real pending operations; no invented percentage completion. | — |
| No unsupported mock functionality | done | src/lib/store/repo.ts:117; src/lib/ai/provider.ts:158 | Local results come from pixels and unavailable AI is explicit. | — |
| Sample data labelled | done | src/app/Desk.tsx:157; src/app/Desk.tsx:181; src/app/projects/[id]/ProjectWorkspace.tsx:483; src/lib/store/repo.ts:235 | UI/module and persistence path present where applicable. | — |

### M. Delivery

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| README install steps | partial | README.md:27; README.md:32 | Node/npm and commands are present, but the copyable clone URL still contains <your-account>. | G10: Replace placeholder with https://github.com/LapisLuong/frameproof.git (S). |
| .env.example | done | .env.example:1 | UI/module and persistence path present where applicable. | — |
| Architecture overview | done | docs/ARCHITECTURE.md:1; README.md:80 | UI/module and persistence path present where applicable. | — |
| Feature checklist | done | README.md:7 | The README workspace capability table serves as the feature checklist; no particular checkbox syntax is required. | — |
| Test results | done | docs/QA.md:5 | UI/module and persistence path present where applicable. | — |
| Known limitations | done | docs/QA.md:54 | UI/module and persistence path present where applicable. | — |
| Screenshots | done | README.md:5; docs/QA.md:19; qa/screenshots/02-project-1024.png | UI/module and persistence path present where applicable. | — |
| Next milestones | done | docs/QA.md:70 | UI/module and persistence path present where applicable. | — |

### N. Definition of done

| Requirement | Status | Evidence | Assessment | Minimal fix and size |
| --- | --- | --- | --- | --- |
| App starts | done | package.json:10; docs/QA.md:12; tests/e2e/journey.spec.ts — keyboard: skip link and visible focus | Existing checks document startup/build; not rerun in this read-only audit. | — |
| Create project | done | tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export | UI/module and persistence path present where applicable. | — |
| Upload two real images | done | tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export | Tests upload actual PNG sample files, not fake measured payloads. | — |
| Interactive compare | done | src/components/CompareStage.tsx:230; src/components/CompareStage.tsx:244; tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export | UI/module and persistence path present where applicable. | — |
| Genuine local analysis | done | src/lib/store/repo.ts:123; src/lib/analysis/analyze.ts:57; tests/unit/analysis.test.ts — identical images: SSIM 1, hash distance 0, nothing changed | UI/module and persistence path present where applicable. | — |
| Save report | done | src/lib/store/repo.ts:139; tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export | UI/module and persistence path present where applicable. | — |
| Mark resolved | done | src/lib/store/repo.ts:155; tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export | UI/module and persistence path present where applicable. | — |
| Export | done | tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export | Downloaded Markdown and JSON content is asserted. | — |
| Persists across reloads | done | tests/e2e/journey.spec.ts — create, upload two images, compare, review, resolve, persist, export; tests/e2e/journey.spec.ts — analyzer → style → CSS export | Saved data persists; unsaved drafts are separately incomplete under K. | — |
| AI fails gracefully | done | tests/unit/ai.test.ts — fails after two invalid answers instead of inventing a review; tests/e2e/journey.spec.ts — AI route reports it is unconfigured and refuses to fabricate | UI/module and persistence path present where applicable. | — |
| No decorative required buttons | done | src/components/CompareStage.tsx:208; src/app/projects/[id]/ProjectWorkspace.tsx:276; src/components/ProofNotes.tsx:115 | UI/module and persistence path present where applicable. | — |
| Works at 1440/1024/390 | done | docs/QA.md:21; playwright.config.ts:14; tests/e2e/journey.spec.ts — sample project loads with live findings @responsive | Existing screenshot evidence includes project at all three widths. Automated responsive checks cover 1440/390; 1024 is visual evidence, not a full automated journey. | — |
| No major errors | partial | src/app/styles/Styles.tsx:71; src/app/styles/Styles.tsx:347; src/app/projects/[id]/ProjectWorkspace.tsx:386; src/components/ConfirmDialog.tsx:36 | Style saves/new-style creation, project edits and delete callbacks can reject without any user-facing error; no error-path coverage proves these recover. Corrupt records can crash render. | G2/G3: Await/catch mutation failures with retained input and actionable messages; validate local records (M each, shared fixes). |

## Concrete triggers for the highest-impact gaps

1. **G1:** Type unsaved review notes, then select another review version. The keyed ReviewControls unmounts; beforeunload never fires. Likewise edit a style and select another saved style; edit a library reference and press Escape/click outside. Project name/brief and new-project drafts also lack unload protection. Exporting with dirty review notes exports the last saved notes without warning (ProjectWorkspace.tsx:246). Include this in the same draft-handling fix.
2. **G2:** Fail an IndexedDB style write (for example storage quota) and press Save style or New style. Their async handlers have no catch and show no actionable failure. Reject listStyles: Styles shows “Opening styles…” even though useStore has status:error. Analyzer likewise does not render current/recent loader failures. ConfirmDialog accepts onConfirm as void and closes immediately without awaiting async deletion or displaying its rejection.
3. **G3:** A malformed stored style with palette:null is returned as StyleSystem without validation; opening it invokes s.palette.map. A malformed reference tags value can similarly break search. An error boundary can catch a crash, but does not identify/isolate the corrupt record or recover usable work. This audit did not inject any data.
4. **G4:** Save review 1, replace the current image, run review 2, then select review 1. Old findings/measurements load and a stale warning appears, but CompareStage still receives d.reference/d.current from the latest project. Saved historical blobs have no UI retrieval path.
5. **G5:** Enter “sm: 8px” plus an invalid token line in Spacing tokens; Save style filters the invalid line and marks the form saved. The existing E2E “analyzer → style → CSS export” explicitly verifies invalid content disappears, but does not protect the user from losing it. The hint discloses dropping content in general; it does not validate a line or ask before discarding that edit.

## Verification limits

The supplied QA reports 55 unit and 12 E2E passes plus build/typecheck/lint results. This report does not independently reconfirm those outcomes. Mobile E2E runs only @responsive cases and 1024 has screenshot evidence rather than an automated full journey. No real configured-provider request has been verified, as QA explicitly states. These are confidence limits on the available evidence, not additional P2 gaps.
