# Design — Rust-owned account-sync phase machine

**Date (UTC):** 2026-10-15  
**Status:** Implementing · Step B landed (read-only snapshot)  
**Parent:** [native-shell-thin-webview-design-2026-10.md](./native-shell-thin-webview-design-2026-10.md)  
**Evidence:** E40–E43 · Settings `runManualAccountSyncRestore` · thin unlock skip auto-sync

---

```text
HANDOFF ATOMIC STEP: Step B done — account_sync_snapshot read-only; Settings still JS restore
PAUSED / CANCELLED: Auto-rehydrate on unlock · dual JS+Rust restore ticks · Soft L3 Fixed
CANONICAL OWNER (target): apps/desktop Rust account-sync phase machine
PROOF BEFORE DONE: Intent-only restore from Settings; unlock journal has zero 30078 storm
```

## Problem

Account sync today is **TS-owned lifecycle** that crosses the bridge for sign/publish/engine reads. On unlock that became a stampede (`sign_kind:30078`, rehydrate, mutation publish). Slice 2 **subtracted** auto paths and exposed Settings-intent restore — correct interim, not the end state.

Anti-bridge rule: do not leave restore timers in JS **and** add Rust APIs for the same lifecycle.

## Target ownership

| Concern | Owner | WebView role |
|---------|-------|--------------|
| Phase machine (`idle` → `restoring_*` → `ready` / `error`) | **Rust** | Read snapshot only |
| When restore runs | **Rust** — Settings intent / explicit command; never unlock mount | `account_sync_run_restore` invoke once |
| Encrypted backup fetch/apply orchestration | **Rust** (or existing engine cmds behind one façade) | Progress events |
| Relay pool dial / NIP-04 encrypt in browser | **TS in-process** until a single Rust relay owner exists | Do not dual-own |
| UI status (Settings Account Sync card) | **TS** paints snapshot from push/poll-light | No interval restore |

## Incremental delivery

| Step | Deliverable | Status |
|------|-------------|--------|
| A | Design | Done |
| B | Rust `AccountSyncState` + `account_sync_snapshot` | **Landed** · L1 unit tests pass |
| C | `account_sync_run_restore` replaces Settings JS body | Next |
| D | Delete desktop thin auto rehydrate/publish remnants | Later |
| E | Native backup publish schedule | Optional later |

### Step B artifacts

- `apps/desktop/src-tauri/src/account_sync_state.rs`
- `apps/desktop/src-tauri/src/commands/account_sync.rs` → `account_sync_snapshot`
- Permission: `allow-misc-commands`

Default snapshot: `phase=idle`, `in_flight=false`. No unlock autopilot.

## Invariants

1. **One flight** — second restore intent while `restoring_*` returns `in_flight` (Step C).  
2. **Unlock silence** — no phase transition driven by provider mount.  
3. **Budget** — engine reads under existing coalesce/budget.  
4. **Rollback** — Settings button stays on JS `runManualAccountSyncRestore` until C green.

## Open questions (resolve before C)

1. Does restore need live TS relay pool, or can Rust use existing mesh/relay sidecars?  
2. Snapshot push vs rare poll — prefer Tauri event.  
3. How encrypted backup crypto stays E2E in WebView while orchestration is Rust?

_Last updated: 2026-10-15T10:40:00Z_
