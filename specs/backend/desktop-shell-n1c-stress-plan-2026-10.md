# Plan — N1c profiles / shell stress (L2-class)

**Date (UTC):** 2026-10-13  
**Status:** Running  
**Budgets:** [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md) §4.2  
**Investigation:** desktop-shell-lag E19–E21

## Threat class

**T1 IPC / always-on mount** — prove startup-picker path stays free of messaging invoke under idle + light nav stress.

## Phases

| Phase | Mode | Pass |
|-------|------|------|
| **S0** | Cold start, keychain rehydrate, startup picker preferred | First `[invoke-pressure]` has **no** `engine_invoke` / `insertTombstone` / `listGroup*` / `sign_event_native` |
| **S1** | Idle on `/profiles` ≥5 min (CDP-on for automation tax noted) | Messaging methods stay **flat**; lease ≤1/min; no heap |
| **S2** | Stress **on `/profiles` only**: focus/visibility churn · Advanced toggle · menu clicks · SPA replace `/profiles` | No messaging remount; stay on picker; no heap. Do **not** navigate to `/`/`/sign-in` (unlocked leave intentionally mounts chat). |
| **S3** | Optional CDP-off idle ≥10 min (honesty soak) | Same as S1 without CDP attach |

## Commands

```text
# Terminal 1
pnpm -C apps/coordination dev

# Terminal 2 — CDP on for S0–S2 automation
OBSCUR_ALLOW_STALE_SHELL=1 OBSCUR_SKIP_TOR_GATEWAY=1 OBSCUR_USE_DOCKER_RELAY=0 \
  pnpm dev:desktop:no-coord -- --skip-build

# Stress harness
node scripts/n1c-profiles-stress-cdp.mjs
```

## Non-goals

10k scroll (N2) · dual-profile CDP tax matrix · stack rewrite
