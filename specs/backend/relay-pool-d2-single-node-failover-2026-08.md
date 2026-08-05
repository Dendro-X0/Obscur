# D2 — Single-node auto-correct failover

**Date (UTC):** 2026-08-04  
**Parent:** [relay-pool-auto-correction-modes-design-2026-08.md](./relay-pool-auto-correction-modes-design-2026-08.md)  
**Related:** [r-relay-rust-4-ts-failover-subtraction-design-2026-07.md](./r-relay-rust-4-ts-failover-subtraction-design-2026-07.md)

---

```text
NEXT ATOMIC STEP:     D2 Single-node auto-correct failover
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      Rust mesh when meshSchedulerOwnsFailover; else TS policy + reconcile
PROOF BEFORE DONE:    L1 policy + supervisor; L3 kill-primary soak deferred
OUT OF SCOPE:         Dual TS+Rust failover · Soft L3 Docker · public Nostr SLA
```

---

## Ownership matrix (one owner)

| Condition | Who switches primary | TS `shouldAttemptPrimaryFailover` |
|-----------|----------------------|-----------------------------------|
| `meshSchedulerOwnsFailover === true` | **Rust mesh scheduler** | Always `false` |
| Mesh not owning + `transportMode === "basic"` (Single-node) | **TS** via `reconcilePrimarySelection` | Allow probe on instability reasons even if standby already writable |
| Mesh not owning + `redundancy` (Multi-node) | **TS** (existing) | Zero-writable reasons / S2 `allowWithWritableRelays` / recovery exhausted |

Mental model (Single-node, mesh-unowned):

```text
Primary unstable (no_writable / publish_timeouts / …)
  → recovery or proactive cycle
  → shouldAttemptPrimaryFailover(basic) may be true even if standby writable
  → attemptPrimaryFailover → reconcilePrimarySelection
  → promote healthy enabled standby; no-op if primary still best
```

When mesh owns: same instability is Rust’s job — TS must not dual-switch.

---

## Gap closed in D2

Recovery-path `tryPrimaryFailover(reason)` previously required `writableRelayCount === 0` unless `allowWithWritableRelays` (only set on the proactive S2 path). In **basic** mode the dial set may already include a live standby while the **primary label** is still a dead public node — auto-correct must still probe reconcile.

**Tighten:** pass `transportMode` into the policy; for `basic`, instability reasons allow the probe when writable>0.

---

## Proof

| Layer | Result |
|-------|--------|
| L1 policy + supervisor + gate | **Pass** (28) — 2026-08-04 |
| L3 kill-primary soak | **Deferred** — not claimed |
