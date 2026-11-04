@AGENTS.md

## Claude Code notes

- Start each session by reading `docs/QA.md` → "Next milestones" to see what's open.
- Use plan mode for anything touching `src/lib/analysis`, `src/lib/review/engine.ts` or `src/app/api/review/route.ts`;
  these carry the "never fabricate" guarantee and have unit tests that must stay green.
- After UI changes, start `npm run build && npx next start -p 3100`, run `node scripts/qa-screens.mjs`, and look at the
  screenshots before calling the work done.
