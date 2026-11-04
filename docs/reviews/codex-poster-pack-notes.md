# Poster pack and export handoff

## Built

- Six original template files, ordered exhibition, exhibition-type, editorial-image, editorial-type, music, collage; parsed `TEMPLATES` and `getTemplate` exports.
- Eighteen reusable items grouped by type, shape, frame, mark and info; parsed `ITEMS` and `getItem` exports.
- Vietnamese text, built-in font faces and MIT `OWN_LICENCE` throughout. Each template has a different palette and composition. All photographs are empty slots; the collage uses overlapping slots and flat geometric overlays. Only the exhibition title deliberately crosses the canvas edge, labelled `(cropped)`.
- Environment-neutral SVG export with injected measurement/font/resource loaders, used-face embedding, image data URLs and missing-resource reporting.
- Portable JSON bundles with Zod validation, canonical base64, size limits, duplicate/missing-resource checks, MIME/magic-byte and byte-count checks, resource/layer-kind checks, image header limits and metadata dimension checks.
- Browser PNG raster helper with injected image/canvas creation, object-URL cleanup and pure 8192-pixel / 40-MP cap calculation.
- Font signature validation and 10-MB limit; image signature sniffing reuses the existing validator. No dependencies, downloads, generated artwork or network requests were added.

## Decisions and contract feedback

- Template/item source values are typed as inputs and validated at module initialization; index exports are parsed output values.
- SVG includes only visible text faces, while resource completeness follows `referencedResources`, including hidden layers, so bundles remain portable when layers are revealed.
- Bundle creation filters unrelated resources and validates its own output with the same import path.
- Image resources receive the existing header/dimension validation in addition to the requested magic-byte checks. Font signatures establish format only, not whether a font is fully decodable or licensed.
- No contract files were changed. Suggested owner changes: `isBuiltinFont` should use an own-property check rather than `in` (prototype names should never count as fonts). `ResourceMetaSchema` could refine kind/MIME agreement. The font registry permits Be Vietnam Pro italic at weights 500/600 but ships only the 400 italic face; the editor should restrict those combinations or provide the missing faces. This pack uses supported combinations.
- The export loader is expected to supply the bytes/MIME for its requested resource and reject decoding/loading failures; import validation belongs to `parseBundle` and the resource ingestion UI.

## Verification

Passed final checks:

- `npx tsc --noEmit -p .`
- `npx eslint src/lib/design/templates src/lib/design/items src/lib/design/export.ts src/lib/design/resource-validate.ts tests/unit/design-templates.test.ts tests/unit/design-export.test.ts tests/unit/resource-validate.test.ts`
- `npx vitest run`: **115 passed, 4 skipped, 119 total**, across **10 passed files and 1 skipped file**.
- Targeted pack/export/resource suite: **31 passed**, across **3 passed files** (templates: 4; export: 16; resource validation: 11).

Environment limitations:

- `npm run build` failed because Turbopack cannot resolve `next/package.json` within this worktree's root (the pre-existing node_modules entry is untracked/shared). No dependency/config files were changed to work around this.
- `npm run test:e2e` failed before running tests: sandbox denies binding `0.0.0.0:3100` (`EPERM`).
- Chromium cannot launch: sandbox denies its macOS Mach bootstrap registration. Browser screenshots at 1440/1024/390 and `qa-screens.mjs` therefore remain unverified. There is no `/design` route in this worktree yet. A temporary local SVG contact sheet was rasterized and visually inspected with fallback fonts; this is not a substitute for actual-font browser QA.
- Git staging/committing failed: sandbox cannot create `/Users/lapisyeu/Documents/FrameProof/.git/worktrees/FrameProof-codex-design/index.lock` (`Operation not permitted`). No commits were created. Intended logical commits: template/item pack and tests; export/resource validation and tests/notes. Use author `LapisLuong <177215296+LapisLuong@users.noreply.github.com>`.

Only assigned source/test/notes files were authored. Existing untracked `node_modules` was left untouched.
