# Investigation — Desktop online startup too slow

**Date (UTC):** 2026-08-04  
**Handoff:** Maintainer — client ready + optimize startup  
**Evidence:** Terminal `pnpm dev:desktop:online` 2026-08-04

---

## Session header

```text
NEXT ATOMIC STEP:     Desktop startup optimize (stale false-positive + relay wait)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION
CANONICAL OWNER:      scripts/lib/static-shell-stale.mjs · scripts/dev-workspace-stack.mjs
PROOF BEFORE DONE:    L1 unit tests · boot without test-triggered rebuild · shorter Docker-down path
OUT OF SCOPE:         COM-RUN · AUTH-SESSION · webpack HMR as ship proof · O-2
```

---

## Observed cost (this boot)

| Phase | Cost | Cause |
|-------|------|-------|
| Static shell rebuild | ~60s+ Next export | `use-conduit-mesh-relay-pool.http-writable.test.ts` marked shell **stale** |
| Local Docker relay wait | **90s** full timeout | `dev-relay-docker` exits immediately (Docker down); stack still polls `:7000` |
| Coordination | ~12s grace (OK) | External worker already healthy |

False-positive stale: **test files are not shipped in `out/`** — must not force rebuild.

---

## Fix direction (smallest)

1. Exclude `*.test.*` / `*.spec.*` / `__tests__` (already) / `*.contract.test.*` from `collectNewestSource`.
2. `ensureRelay`: when Docker relay child exits non-zero, stop waiting immediately (don't burn `DEFAULT_RELAY_READY_TIMEOUT_MS`).

Optional later: two-terminal workflow already documented; not a code fix.
