# Design — R-RELAY-1 public pool membership + failover honesty

**Status:** Implemented · L1 Pass · 2026-07-30  
**Study:** [r-relay-0-integration-study-2026-07.md](./r-relay-0-integration-study-2026-07.md)  
**Charter:** [r-relay-transport-refactor-charter-2026-07.md](./r-relay-transport-refactor-charter-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     R-RELAY-1 implement — active pool + failover subtract
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      resolveActivePoolRelayUrls + shouldAttemptPrimaryFailover + relay-provider attemptPrimaryFailover
PROOF BEFORE DONE:    L1 selector/policy tests · L3 optional failover soak
OUT OF SCOPE:         Conduit-mesh cutover · new failover owner in the React hook · community
```

---

## Problem

Redundancy mode filters pool candidates with `score > 0`. Disconnected relays score **0**, so a flapping/error primary that still scores can monopolize the active pool; standbys stay cold with “wait for automatic failover” copy while failover may never open sockets for them.

`basic` mode intentionally single-primary — leave that behavior; ensure presets/docs stay clear.

---

## Target (subtraction)

### A. `resolveActivePoolRelayUrls` (redundancy)

When building the redundancy pool:

1. Prefer scored open/writable URLs (unchanged intent).  
2. **Pad** with remaining `orderedEnabledUrls` (skip circuit-open) up to `maxRedundancy` so never-connected standbys still get sockets.  
3. Always prefer current `selection.primaryUrl` first when still in the enabled list (unless circuit-open).  
4. Do **not** reintroduce health auto-reconcile inside `useRelayPrimarySelection`.

### B. Failover trigger (keep single owner)

Ensure `attemptPrimaryFailover` runs when primary connection is failed/disconnected and `writableRelayCount === 0`, using existing `shouldAttemptPrimaryFailover` — amend policy only if L1 shows ERROR primary never yields `writableRelayCount === 0`. Prefer policy tweak over a second owner.

### C. Dialects

No change to preset catalog in this slice except verifying redundancy public packs still set `transportMode: "redundancy"`. Private/local packs remain valid alternatives.

---

## Mental simulation

**Before:** damus ACTIVE ERROR · nos/primal STANDBY DISCONNECTED · no sockets on standbys.  
**After:** redundancy profile opens up to 3 enabled URLs; if damus dead, others can connect; failover can promote primary role to a live member.  
**Alternate path:** Apply `local_dev_mesh` → only `:7000` — still works.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm exec vitest run app/features/relays/services/relay-primary-selector` (+ failover policy tests) |
| L3 | Optional: desktop redundancy · fail primary · observe second URL connect / role promote |

## Claim

| May say | When |
|---------|------|
| Implemented | Diff matches A–C |
| Verified | L1 Pass |
| Public Nostr fixed | L3 Pass **or** upstream-all-down + local mesh documented |

---

## Forbidden

- Auto-reconcile in primary-selection hook  
- Second supervisor  
- Claiming Cloudflare/damus upstream fixed  
- Touching community
