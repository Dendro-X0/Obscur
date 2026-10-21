# Design — Slice 2 remount (after thin unlock)

**Date (UTC):** 2026-10-15  
**Status:** Implementing (Settings intent landed; kernel remount deferred)  
**Parent:** [native-shell-thin-webview-design-2026-10.md](./native-shell-thin-webview-design-2026-10.md)  
**Evidence:** E40 no-freeze · E41 rebuild idle total=25 (no 30078/tombstones)

---

```text
HANDOFF ATOMIC STEP: Slice 2 — Settings-intent account sync + keep thin unlock
PAUSED / CANCELLED: Soft L3 Fixed · plane soak loops · remount all owners at once
CANONICAL OWNER: account-sync-manual-intent · unlock-hydrate-policy
PROOF: Manual restore from Settings works; unlock journal lacks 30078/listTombstones storm
```

## Goal

Thin unlock stays the default. Features return **one owner at a time**, never as dual-bridged mount storms.

| Feature | Remount rule |
|---------|----------------|
| Account sync restore/publish | **Settings intent only** (`runManualAccountSyncRestore`) until Rust phase machine exists |
| Presence / 30315 | Stay ExperimentNetworkShell on desktop until native schedule owns heartbeat |
| WorkspaceKernel / warmup / cold-repair / leases | Remount only behind deferred idle + Rust budget; not on unlock frame |
| Tombstone ensureReady | Skipped on desktop thin; thread open may call later |

## Landed

- Skip auto restore **interval/visibility** on desktop thin  
- Skip mutation publish subscription on desktop thin  
- `localDmVisibilityOwner.ensureReady` no-ops hydrate on desktop thin  
- `account-sync-manual-intent.ts` + Profile Settings **Restore from relays**  
- Rebuild `shell-2026-10-15T09:31:12Z` · E41 idle journal clean  

## Slice 2b — deferred WorkspaceKernel remount

| Constraint | Rule |
|------------|------|
| Unlock frame | Thin branch still skips warmup / cold-repair / leases / ingest |
| First remount | `DeferredWorkspaceKernelMount` → `WorkspaceKernelProvider` alone |
| When | ≥2s post-unlock then `scheduleUnlockPathHeavyWork` (idle) |
| Budget | Eng reads remain under Rust coalesce/budget; fail soft-empty |
| Proof | Unlock frame calm; after +2s kernel may attach; no 30078/tombstone storm |
| Rollback | Remove `DeferredWorkspaceKernelMount` wrapper |

Owners still **out**: `DesktopWarmupOwner`, `DmKernelColdStartRepairOwner`, `ActiveSessionLeaseOwner` (E43 stampede), `WorkspaceKernelGroupRelayIngestOwner`, full presence.

### Slice 2c — aborted

Deferred `ActiveSessionLeaseOwner` caused `desktop_touch_active_session_lease` ~1/s. Rolled back. Prerequisites before retry: JS touch coalesce (landed) + owner release-on-unmount-only (landed) + soak on non-thin path.

## Next

1. Settings → **Restore from relays** spot-check.  
2. Hold thin path at Slice 2b (kernel only).  
3. Optional: Rust-owned account-sync phase machine design.

_Last updated: 2026-10-15T10:16:00Z_
