# Independent FrameProof code review

Reviewed 4 November 2026 against AGENTS.md and the architecture/QA documents. Scope: `src/lib/image/validate.ts`, all files in `src/lib/analysis` and `src/lib/color`, `src/app/api/review/route.ts`, and `src/lib/ai/provider.ts` plus its AI schema dependency. Production code was not changed.

Result: **0 high, 2 medium, 2 low findings**. Each originally had one failing regression test; these now pass in the matching existing unit test files.

Verification:

- `npx vitest run tests/unit/review-findings.test.ts`: **4 failed**, each at its expected behavior assertion (not import/setup failures).
- `npx vitest run tests/unit/analysis.test.ts tests/unit/ai.test.ts tests/unit/validate-and-review.test.ts`: **37 passed**.
- No packages installed, no Git commands, no production changes. Build, e2e and screen captures were not run for this review-only change.

## F1 — Actual request body is not bounded before multipart parsing

**Severity:** medium. **Location:** `src/app/api/review/route.ts:45`, `src/app/api/review/route.ts:52`.

**Failing input:** configured AI; a real multipart `Request` with an unused text field exceeding `2 * MAX_UPLOAD_BYTES + 256 * 1024` (31,719,680 bytes), but `content-length: 1`.

**Observed:** the handler consumes and parses the oversized multipart body, then returns **400**, “The measurement context was malformed.” The test checks that message before checking the status, proving it reached context validation after parsing. Only the header value is bounded; there is no bound on bytes read, unused fields, or aggregate multipart data. Per-image limits run after parsing and cannot protect this allocation.

**Expected:** stop reading at the aggregate cap and return **413** before multipart parsing can buffer an oversized request.

**Impact/verification boundary:** verified at the Fetch `Request`/route-handler boundary. Memory exhaustion is possible if an adapter passes through a body whose length disagrees with the header. This is **not a verified remote HTTP exploit**: HTTP framing, reverse proxies, and hosting limits may prevent such a request from reaching the handler. No request-smuggling or deployed-server bypass is claimed.

**Test:** `F1: actual multipart body size is not bounded`.

**Minimal fix:** retain the declared-length fast rejection, but read the stream with a running byte count and cancel/return 413 as soon as it exceeds the cap. Parse only bounded bytes using a reconstructed Request with the original multipart Content-Type. Validate declared sizes as finite nonnegative integers as well. Alternatively enforce and document an equivalent hard limit at the actual server adapter boundary.

**Fixed:** Bounded the body stream before multipart parsing and canceled on overflow; retained declared-length validation. Tests: `ai.test.ts`.

## F2 — Fractional resampling assigns the wrong pixel coverage

**Severity:** medium. **Location:** `src/lib/analysis/pixels.ts:79`, `src/lib/analysis/pixels.ts:83`.

**Failing input:** opaque 3×1 grayscale pixels `[0, 255, 255]`, resampled to 2×1.

**Observed:** output grayscale is `[0, 255]`. Flooring both source boundaries gives the first output only the black source pixel and the second output both white source pixels.

**Expected:** the documented area average is `[85, 255]`: the first destination covers source interval `[0, 1.5)`, so `(0 * 1 + 255 * 0.5) / 1.5 = 85`. The second covers `[1.5, 3)` and is entirely white.

**Impact:** incorrect weighting changes tone and color distributions for noninteger scale ratios. This function feeds downscaling, palette/structure analysis, fit-contain comparison, SSIM and dHash, so the error reaches measured results on ordinary images; it is not an invalid-buffer-only case.

**Test:** `F2: fractional area resampling loses source pixel coverage`.

**Minimal fix:** retain fractional destination footprints in source coordinates; iterate from floor(start) to ceil(end), weighting each source pixel by its intersection area. Multiply RGB accumulation by both overlap and alpha, accumulate alpha by overlap, and divide final alpha by total overlap. For example, horizontal weight is `max(0, min(xx + 1, right) - max(xx, left))`; multiply by the analogous vertical weight.

**Fixed:** Applied fractional intersection-area weights, alpha-weighted RGB, and area-normalized alpha. Integer-ratio output is covered; existing analysis expectations are unchanged. Tests: `analysis.test.ts`.

## F3 — Invalid context JSON becomes a misleading provider error

**Severity:** low. **Location:** `src/app/api/review/route.ts:59`, `src/app/api/review/route.ts:67`.

**Failing input:** correctly encoded, bounded multipart request with `context` equal to `{`, under configured AI.

**Observed:** `JSON.parse` throws before Zod runs. The outer catch turns the client input error into **502**, “The AI review failed unexpectedly,” and logs it as an AI review error. No provider call has occurred.

**Expected:** **400**, the same malformed-context response used for JSON values failing the context schema.

**Test:** `F3: invalid context JSON is reported as a provider failure`.

**Minimal fix:** parse context JSON in a local try/catch and return the existing 400 malformed-context response on SyntaxError, then run `MeasuredContextSchema.safeParse` on the parsed value.

**Fixed:** Caught context JSON parsing locally and returned the existing malformed-context 400. Tests: `ai.test.ts`.

## F4 — Corrupt VP8L signature is accepted as a valid image header

**Severity:** low. **Location:** `src/lib/image/validate.ts:53`.

**Failing input:** a valid sharp-generated 1×1 lossless WebP, with its mandatory VP8L signature byte at offset 20 changed from `0x2f` to `0x00`. RIFF/WEBP/VP8L tags and dimension bits are unchanged.

**Observed:** `validateImageBytes` returns `ok: true` with dimensions 1×1. The test first confirms sharp cannot decode exactly those bytes, then fails on the validator accepting them. The parser skips the codec signature and reads the following bits as dimensions even though the VP8L header is invalid.

**Expected:** reject this malformed header before decoding, as required by the upload validation contract. This does not require proving arbitrary compressed payload validity during header validation: the corrupted byte is part of the header itself.

**Impact:** damaged/forged WebP headers reach decoding despite validation. The server's sharp decode catch still rejects the image; no dimension-cap bypass or decoder exploit is claimed.

**Test:** `F4: corrupt WebP lossless signature passes header validation`.

**Minimal fix:** require `b[20] === 0x2f` before interpreting VP8L dimensions; also validate the VP8L version bits and that the RIFF/chunk lengths can contain the header being read. Reject invalid headers with `null`.

**Fixed:** Checked VP8L signature, version bits, buffer size, and RIFF/chunk header bounds. Tests: `validate-and-review.test.ts`.

## Checked and found correct

- sRGB integer lookup transfer curve, inverse transfer curve, Oklab matrices, Euclidean Oklab distance, and WCAG luminance/contrast thresholds are internally consistent. Existing round-trip, black/white, known-contrast and truncation tests pass.
- SSIM uses `C1 = .01²`, `C2 = .03²` for luma range 1, consistent variance/covariance denominators, and 8×8 windows with stride 4. Existing identity and moved-block comparisons pass.
- Palette extraction uses a seeded PRNG, excludes alpha below 128, weights merged clusters by membership, and reports excluded transparency. Existing deterministic/share tests pass.
- Structure computes Sobel magnitudes, normalized centroids, RMS contrast and histograms deterministically; quiet area is explicitly estimated. Existing flat-image and detailed-corner tests pass.
- Upload validation rejects ordinary over-byte/over-pixel/over-side inputs and unsupported magic bytes. Server preparation also independently sets sharp's 40 MP limit, strips metadata and bounds the outgoing image size.
- Provider destinations come from server configuration, not request-controlled URLs. Normal provider errors do not echo API keys or provider response bodies. No client import or deployment-level network audit was performed outside the requested scope.
- Provider replies are parsed and Zod-validated before return; unknown measurement fields are stripped, observations are bounded, and conversion to issues forces `ai-observed`. Existing invalid-output, retry, rejected-key and evidence tests pass. The unconfigured route returns 503 before image preparation.
