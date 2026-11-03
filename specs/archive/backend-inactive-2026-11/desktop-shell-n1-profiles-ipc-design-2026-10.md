# Design — N1 profiles IPC cut + PL1 light shell

**Date (UTC):** 2026-10-13  
**Status:** Implementing N1b (E20)  
**Investigation:** [desktop-shell-lag-investigation-2026-10.md](./desktop-shell-lag-investigation-2026-10.md) E19–E20  
**Handoff:** N1 IPC coalesce + PL1 progressive gate

## Problem

Unlocked (or keychain-rehydrated) windows on `/profiles` mount `UnlockedAppRuntimeShell`, driving engine/relay/lease IPC while the UI is only a profile picker. Commit charge exhaustion + `STATUS_HEAP_CORRUPTION` follow. E20: quiet picker then remount (`desktop-warmup-progress`) + heap.

## Invariants

1. Desktop public profile routes (`/profiles*`) never mount messaging/relay/DM providers — gate on **desktop shell build or** native bridge (bridge alone is insufficient).
2. Lease heartbeat ≤ TTL/2; JS TTL matches Rust `ACTIVE_SESSION_LEASE_TTL_MS`.
3. Picker lease list polls are no-ops while hidden; list results cached ≤8s; picker poll interval ≥ TTL (not heartbeat).
4. Tor status reads from auto-lock share the Slice 3i adapter cache (invalidate after start/stop).
5. Picker harvest IPC cached ≥60s; preview reload keyed by profile-id fingerprint; focus isolation refresh throttled.

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | Source contract: `AppSessionShell` light shell without `!isUnlocked`; uses desktop shell OR native |
| L1 | Lease 60s/30s; harvest cache; list poll uses TTL |
| L3 | CDP-off `/profiles` idle · no `desktop-warmup-progress` · no heap ≥10 min |

## Non-goals

Stack rewrite · 10k sliding window (N2) · CDP removal from debug default
