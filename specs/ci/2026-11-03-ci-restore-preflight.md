# CI restore preflight — 2026-11-03

**Intent:** Re-engage GitHub branch CI (`docs-check` · `version-check` · `reliability-gates`) after offline rewrite/docs waves **without** push-and-wait failure loops.

**Status:** restore-ready (local T0–T4 Pass) — push still maintainer-gated  
**Workflows (GitHub):** all six listed `active` — not disabled in Actions UI. “Restore” = local HEAD CI-ready, then push so gates run green.

## Session header

```text
HANDOFF ATOMIC STEP: beta.4 via Full Release CI / record from release exe · Wave 6 optional
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · local desktop:package/build:exe
CANONICAL OWNER:    reliability-gates + release:test-pack (scripts)
PROOF BEFORE PUSH:  T0 → T1 → T2 → T3 → T4 — all Pass locally 2026-11-03
NATIVE BUILD:       not in this band (Full Release later)
```

## Baseline (remote)

| Item | Value |
|------|--------|
| `HEAD` / `origin/main` | `03183f4c` (in sync; work is **uncommitted**) |
| Last green `reliability-gates` | 2026-11-01 — video-player tsc fix |
| Recurring historical class | **typecheck** in `apps/pwa` tests (fixed on main) |

## Local gate results

| Tier | Result | Notes |
|------|--------|-------|
| T0 version:check | Pass | 2.0.0 aligned |
| T1 docs:check | Pass | 70 markdown files |
| T2 tsc + contracts | Pass | |
| T3 engine-lab | Pass after contract drift fixes | see iteration log |
| T4 release:test-pack --skip-preflight | Pass (~185s) | 102 files / 580 tests in focused pack |

## Fixes landed this band (verify-script / barrel-contract class)

| File | Change |
|------|--------|
| `apps/pwa/app/engine-lab/engine-host-headless-w0.contract.test.ts` | Assert `@obscur/engine-host/subprocess` not root re-export |
| `packages/dweb-auth/src/auth-kernel.contract.test.ts` | Import policy/result helpers from leaf paths |
| `apps/pwa/app/features/dm-kernel/p4-bundle-diet.contract.test.ts` | `shouldUseEagerShellSidebarRoute` rename |
| `apps/pwa/app/features/workspace-kernel/workspace-kernel-w0-exit.contract.test.ts` | Leave assert on leave-port; root = authority only |

## Known warnings (do not block restore)

1. **Node.js 20 deprecated on Actions** — docs/version-check still pin `20.11.0`; reliability-gates uses Node 22. Separate PR to bump.
2. **transport:boundaries** — 5 allowlist entries with no remaining imports (shrink allowlist later).
3. **Rust** — unused import `nostr::prelude::*` in `libobscur` pow.rs; unused `request` in desktop `invoke_coalesce.rs`.
4. **Node DEP0190** — `ci-local.mjs` shell+args deprecation on Windows.
5. **`.codectx/**`** — dirty noise; exclude from commit.

## Iteration log

| Iter | Action | Result |
|------|--------|--------|
| 0 | Discover workflows + dirty map | workflows active; ~1k dirty paths |
| 1 | T0 / T1 / T2 | Pass |
| 2 | T3 | FAIL — engine-host subprocess root export |
| 3 | Align engine-host contract | Pass slice |
| 4 | T3 | FAIL — `@dweb/auth` root barrel |
| 5 | Align auth contract imports | Pass auth-kernel |
| 6 | T3 tail | FAIL — sidebar rename + workspace barrel |
| 7 | Align p4 + w0-exit | Pass slices |
| 8 | v2-slim + workspace-kernel | Pass |
| 9 | T4 | Pass |

## Exit criteria

- [x] T0 Pass
- [x] T1 Pass
- [x] T2 Pass
- [x] T3 Pass (after contract alignments)
- [x] T4 Pass (`release:test-pack --skip-preflight`)
- [ ] Commit exclude `.codectx` (at push time)
- [ ] Push + first CI run green (maintainer)

**Do not:** dispatch Full Release / tag beta.4 until branch CI green on the restore commit.
