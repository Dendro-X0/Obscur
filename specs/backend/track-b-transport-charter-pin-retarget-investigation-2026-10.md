# Investigation — Track B: transport-engine w68 charter pin ENOENT

**Date (UTC):** 2026-10-15  
**Status:** Root cause identified · fix by path retarget  

```text
HANDOFF ATOMIC STEP: Track B migration runway (after beta A1–A3)
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet
CANONICAL OWNER: engine-lab contract pins + archive docs
PROOF: pnpm verify:transport-engine-w68 exit 0
```

## Finding

1. **W53 / W66 already done** (2026-08-04): sign-off `Decision: PASS`; production `-legacy.ts` absent; thin port live.
2. Stale handoff/index still said BLOCKED — docs drift only.
3. `pnpm verify:transport-engine-w68` fails (~85 tests): charters moved to  
   `docs/archive/program/inactive-2026-08/` but contracts still open  
   `docs/program/transport-engine-w*.md`.

## Fix contract

Retarget all engine-lab / related pins from `docs/program/transport-engine-` →  
`docs/archive/program/inactive-2026-08/transport-engine-`. Update subtraction index status to EXECUTED.

## Landed (2026-10-15T16:02Z)

- 61 files retargeted; zero missing archive docs
- `pnpm verify:transport-engine-w68` → 115 files / 397 tests + cargo OK

_Last updated: 2026-10-15T16:02:00Z_
