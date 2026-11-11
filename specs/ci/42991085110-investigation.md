# CI investigation — Full Release 42991085110

**Date:** 2026-11-11  
**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/42991085110  
**Cut:** v2.0.0-beta.10 remaster publish  
**Primary failure class:** lockfile / install

```text
JOB:   Preflight Checks
STEP:  Install dependencies
ERROR: ERR_PNPM_OUTDATED_LOCKFILE — pnpm-lock.yaml not up to date with apps/desktop-ui/package.json
       lockfile still lists @obscur/engine-host; package.json does not
```

## Fix (this iteration only)

Run `pnpm install` to refresh lockfile for `@dweb/desktop-ui`, commit lockfile, re-dispatch Full Release.

## Not in this iteration

Build / verify / publish jobs (skipped after preflight). Soft L3 / Continuity Pass not claimed.
