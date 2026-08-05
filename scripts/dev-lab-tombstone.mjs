#!/usr/bin/env node
/**
 * Dev Lab entrypoints are tombstoned (2026-07-28).
 * @see specs/backend/production-rewrite-and-devlab-tombstone-2026-07.md
 */
const invoked = process.argv[1] ?? "dev:lab";
console.error(`
[dev-lab] TOMBSTONED — ${invoked} is not a product validation surface.

Dev Lab predates CodaCtrl Studio and greened work that failed in packaged desktop.
Do not use it to claim "done."

Truth surface:
  • Day-to-day:     pnpm dev:desktop          (production parity, no DEV_LAB)
  • Explore/capture: CodaCtrl Studio          (CDP :9230 / :9231 on parity or release exe)
  • Ship smoke:      pnpm desktop:demo-preflight → desktop:build:exe → P1–P4 on exe

Spec: specs/backend/production-rewrite-and-devlab-tombstone-2026-07.md
`);
process.exit(1);
