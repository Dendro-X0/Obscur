# Design — Slice C L3 CDP re-proof (post U3 + Phase 3)

**Status:** Done · 2026-07-31 (incl. post-U2 re-proof)  
**Parent:** [community-u3-slice-c-activation-wrap-design-2026-07.md](./community-u3-slice-c-activation-wrap-design-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: Slice C L3 CDP proof only
PAUSED / CANCELLED:   Full community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation
CANONICAL OWNER:      community-coordination-room-key-owner (C1–C4) + group-service resolve-at-send
PROOF BEFORE DONE:    pnpm verify:slice-c-l3 → test-results/phase1b-slice-c-l3-*.json l3.pass=true
OUT OF SCOPE:         Community un-pause · COM-RUN · UI churn · Dev Lab restore · product code unless harness blocked
```

---

## Why re-proof

| Change since historical 2026-07-04 L3 Pass | Risk to L3 |
|-------------------------------------------|------------|
| U3 activation self-wrap wire | Join/create wrap owner shifted; send path should still resolve via coordination |
| Dev Lab Phase 3 delete | `window.obscurDevLab` gone — harness must use `ensureUnlockedForRuntimeCapture` only |
| R1 hydrate waves | DM-only; should not affect group send |

Historical Pass is **not** sufficient after U3/Phase 3. Fresh CDP evidence required before claiming L3 again.

---

## Prerequisites

1. `pnpm dev:desktop:online` (coordination `:8787`, relay `:7000`, CDP `:9230`, shell)
2. Tester1 unlocked in Tauri (password path — no Dev Lab unlock)
3. NewTest 2 joined in membership ledger (fixture group)

---

## Proof plan

```bash
# Stack already running with CDP
pnpm verify:slice-c-l3
# Pass criteria (unchanged):
#   pre-send localRoomKeyCount=0
#   no room_key_missing_send_blocked
#   coordination recovery proven (hit_coordination | materialize | post-send key)
#   message visible
# Evidence: test-results/phase1b-slice-c-l3-2026-07-03.json (l3.pass=true)
```

---

## Harness hygiene (only if blocked)

| If | Then |
|----|------|
| Spec calls `obscurDevLab.unlock` and unlock fails | Rely on `ensureUnlockedForRuntimeCapture`; remove dead lab calls if they throw |
| Fixture/group missing | Document BLOCKED — do not invent community product patches |
| CDP unreachable | BLOCKED on stack — do not claim L3 |

---

## Claim language

| May say | When |
|---------|------|
| Slice C L3 Pass | Fresh `l3.pass=true` JSON + CDP run this session |
| Slice C L3 fixed / community unblocked | **Never** from this slice alone |
| Dev Lab restored | **Never** |

---

## Closeout evidence (2026-07-31)

- `pnpm verify:slice-c-l3 -- --skip-backfill` with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:1430`
- Evidence: `test-results/phase1b-slice-c-l3-2026-07-03.json` · `l3.pass=true`
- Harness hygiene: no Dev Lab unlock; identity from local session storage; target-group key clear; toast-safe send
- Shell build unblocked: `Window.__OBSCUR_FATAL_BOUNDARY__` type + `dev-lab-window-stub.d.ts`
- **Post-U2 re-proof (same day):** `pnpm verify:slice-c-l3 -- --skip-backfill` again after U2 Wave D — **l3.pass=true** (workspace-engine group persist neighbor)
- **Not claimed:** community un-pause · COM-RUN · Dev Lab validation restored
