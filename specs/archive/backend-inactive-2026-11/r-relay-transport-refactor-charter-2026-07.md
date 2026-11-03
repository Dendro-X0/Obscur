# Charter — R-RELAY transport refactor (public Nostr usable · dialects optional)

**Status:** **AMENDED / STOPGAP** — 2026-07-30 · primary transport redesign moved to **[r-relay-rust-mesh-charter-2026-07.md](./r-relay-rust-mesh-charter-2026-07.md)** (Rust mesh · alternatives first)  
**Un-pauses:** Handoff **Forbidden: R-RELAY rewrite** → sliced charters (this file = TS stopgap; Rust charter = end state)  
**North star:** [obscur-conduit-mesh-concept-2026-06.md](../../docs/program/obscur-conduit-mesh-concept-2026-06.md)  
**Does not un-pause:** community · AUTH-SESSION-1 · Dev Lab

> **Note:** R-RELAY-0/1 (pool pad) remain valid interim mitigations. Do **not** continue TS pool patch loops as the main band — execute **R-RELAY-RUST-*** instead.

---

## Session gate (agents)

```text
NEXT ATOMIC STEP:     R-RELAY-0 integration study (owners + dual paths) — no product code until study Pass
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      transport runtime (target: one mesh/supervisor truth) · nostr_ws dialect adapter · presets
PROOF BEFORE DONE:    Named per slice below
OUT OF SCOPE:         Community roster · second publish owner “for compatibility” · claiming public relays fixed without L3
```

---

## Product intent (goal preservation)

| Goal | Meaning |
|------|---------|
| **Public Nostr usable again** | With a redundancy public/Mixed preset, ≥1 `nostr_ws` endpoint reaches publish/subscribe readiness when upstream allows; when primary dies, **standby promotes** without user babysitting |
| **Alternatives remain first-class** | Local `:7000`, private LAN/HTTP mesh, Tor packs, hybrid presets stay selectable — **Obscur is not a Nostr client** |
| **Honest UX** | ACTIVE / STANDBY / ERROR reflect evidence; soft warnings (already landed); never “Active transport” with zero socket forever |
| **One owner** | Single automatic failover/recovery truth per `(profileId)` — no reconcile ping-pong |

**Non-goals (this charter):** Make every public relay always up · greenfield `@obscur/conduit-mesh` package in one PR · community ingest · AUTH-KERN.

---

## Why refactor (not another patch)

Evidence ([public-relay-connect-fail](./public-relay-connect-fail-investigation-2026-07.md)):

- damus = ACTIVE TRANSPORT + ERROR  
- nos.lol / primal = STANDBY + DISCONNECTED (cold)  
- Probe: dns/tcp ok, WSS/TLS fail on some hosts  

Past freezes: dual owners, render-depth failover loops, “fix banner” without owner subtract. Modular iteration: **silo redesign → integration study → slices**, not scatter reconnect patches.

Conceptual north star already exists: **Conduit Mesh** — `nostr_ws` optional dialect; user-chosen conduits; lane promotion across dialects.

---

## Target architecture (keep-set first)

```text
Kernel (dm / workspace) → TransportPort / evidence
                              │
              ┌───────────────┴───────────────┐
              │  ONE runtime owner            │
              │  (supervisor → mesh later)    │
              └─┬───────────┬───────────┬─────┘
                │           │           │
           nostr_ws    team/http    local/custom
           (public     (private     (:7000 / LAN)
            pool)       mesh)
```

| Concern | Single owner (target) | Must not |
|---------|----------------------|----------|
| Primary / pool membership | `relay-runtime-supervisor` (+ failover policy) until mesh lands | UI auto-reconcile vs supervisor race |
| Dialects / presets | `transport-preset-catalog` + apply policy | Hard-coding damus as only path |
| Native WS | `native-relay` + soft `native-error-store` | Raw probe dumps as primary UX |
| Publish evidence | transport-engine / contracts | Second legacy publish stack |

---

## Slice plan

### R-RELAY-0 — Integration study (this session’s next code gate)

**Deliverable:** Owner map of current parallel paths (pool, supervisor, primary selection, standby probe, preset apply, transport-engine). Conflict scan vs working neighbors (dm-engine publish, soft error panel).  
**Code:** None.  
**Exit:** Study doc Pass → unlock R-RELAY-1.

### R-RELAY-1 — Public `nostr_ws` failover honesty

**Goal:** When ACTIVE primary is ERROR/disconnected and ≥1 enabled standby exists, promote within bounded time; redundancy mode opens pool members (not forever-STANDBY with zero sockets).  
**Proof:** L1 policy/supervisor tests · L3 desktop: kill/fail primary → standby becomes active transport (or local `:7000` substitute if all public WSS down — document which).  
**Forbidden:** New parallel failover owner · UI-only badge lies.

### R-RELAY-2 — Preset / dialect choice clarity

**Goal:** Applying public vs private vs hybrid packs rewrites profile endpoints + mode honestly; cold profiles can leave Nostr entirely.  
**Proof:** L1 preset apply contracts · L3 apply local_dev_mesh → connect `:7000` without public WSS.

### R-RELAY-3 — Soft degrade + recovery messaging

**Goal:** Soft amber panel (already) + Settings copy when zero writable + recovery_exhausted actionable (retry / switch preset / open Network).  
**Proof:** L1 copy contracts · no return of harsh stacked probe toasts.

### R-RELAY-4 — Mesh prep (optional later)

**Goal:** Interface contract toward `@obscur/conduit-mesh` without deleting working supervisors mid-flight.  
**Only after** R-RELAY-1 Pass + integration study amend.

---

## Mental simulation

**Sender:** Profile on Mixed/redundancy · damus dies · expects nos.lol or primal (or local) to carry DM publish without opening Settings.  
**Receiver:** Same envelope evidence path regardless of which dialect delivered.  
**Neighbor must not regress:** Soft error panel · transport-engine checkpoints · dual-owner R3 tombstone · community PAUSED.

---

## Proof language

| May say | When |
|---------|------|
| Chartered | This file + handoff checkpoint |
| Implemented | Slice design + code for that slice only |
| Verified | Named L1–L3 for that slice Pass |
| Public Nostr fixed | R-RELAY-1 L3 Pass on release/parity **or** documented upstream-all-down + local mesh Pass |

---

## Next atomic step

**R-RELAY-0:** Write integration study (`r-relay-0-integration-study-2026-07.md`) — owners, parallel paths, conflict scan, proof plan for R-RELAY-1. **No product code until that study Pass.**
