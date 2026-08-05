# Design — Desktop startup: ignore test stale + fail-fast relay

**Date (UTC):** 2026-08-04  
**Investigation:** [desktop-startup-optimize-investigation-2026-08.md](./desktop-startup-optimize-investigation-2026-08.md)

---

## Changes

### A — `scripts/lib/static-shell-stale.mjs`

Skip source files matching:

```
/\.(test|spec)(\.|$)/i   // *.test.ts, *.spec.tsx, *.contract.test.ts, …
```

Keep scanning real app/package sources. L1: extend `static-shell-stale.test.mjs` — newer `*.test.ts` does **not** stale; newer `.tsx` still does.

### B — `scripts/dev-workspace-stack.mjs` `ensureRelay`

Track relay child exit. If process exits before `:7000` opens, return `false` immediately (warn path unchanged). Do not wait full 90s when Docker is down.

### Proof

| Layer | Command |
|-------|---------|
| L1 | `node --test scripts/lib/static-shell-stale.test.mjs` |
| L2 | Manual: touch a `*.test.ts` under `apps/pwa/app` → `isStaticShellStale` false if `out/` current |
| Claim | Faster cold boot when only tests changed and/or Docker relay unavailable — **≠** Soft L3 |

---

## Status

**Implemented** — L1 Pass (`node --test scripts/lib/static-shell-stale.test.mjs`). Relay fail-fast via child-exit abort + `process.exit` on Docker-down.
