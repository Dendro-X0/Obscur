# Integration study — `relay-publish` dual-owner subtract

**Status:** Study only · 2026-07-30 · **no product code** until design + handoff un-pause  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Related:** [dm-persist-dual-owner-integration-study-2026-07.md](./dm-persist-dual-owner-integration-study-2026-07.md) · [r-rust-boundary-slice3-investigation-2026-07.md](./r-rust-boundary-slice3-investigation-2026-07.md)  
**Trigger:** Maintainer redirect — “dual-owner subtract”

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — relay-publish integration study (this doc)
PAUSED / CANCELLED:   community · COM-RUN-* · dm-persist mutate (until its design) · AUTH-SESSION-1 · Dev Lab
                      (relay-publish rewrite stays PAUSED for mutate)
CANONICAL OWNER (target): transport-kernel publish on native · one EVENT path to relays
PROOF BEFORE DONE:    Writer triage L1 · subtract design · L3 publish OK evidence on parity
OUT OF SCOPE:         conduit-mesh / relay-gateway package rewrites · website · UI-kit · community membership
```

---

## Integration checklist

| Gate | Status |
|------|--------|
| Working neighbors listed | Done — §Neighbors |
| Interface contract | Draft — §Contract |
| Parallel writers classified + subtraction plan | Draft — §Triage / §Subtract |
| Automated scenario named | Draft — §Proof |
| Handoff next step | After maintainer picks first mutate band (`dm-persist` preferred) |

---

## Heuristic writers (CodaCtrl score 22) → role triage

Path-name heuristic (`relay-pool` / `relay-publish` / `relay-gateway`) mixes **hooks, types, frozen packages, and real EVENT publishers**. Same over-count pattern as R-SCOPE.

### A · Freeze / out of keep-set (do not mutate in Rust refactor)

| Path | Role |
|------|------|
| `packages/obscur-conduit-mesh/**` | Frozen mesh runtime — charter freeze |
| `apps/relay-gateway/**` | Frozen gateway — hide registry / HTTP mesh, not PWA EVENT owner |

### B · Noise / non-publish (reader, types, pool wiring)

| Path | Role |
|------|------|
| `enhanced-relay-pool-types.ts` | Types only |
| `enhanced-relay-pool-port.ts` / `relay-pool-hook-port.ts` / `relay-pool-runtime-port.ts` | Ports / adapters |
| `use-relay-pool-ref.ts` / `use-relay-pool.ts` / `use-enhanced-relay-pool-runtime.ts` | Pool hooks |
| `use-conduit-mesh-relay-pool.ts` | Mesh pool hook (freeze-adjacent) |
| `use-transport-kernel-relay-pool.ts` | Kernel pool surface — prefer keep as **read/wiring** |
| `transport-relay-pool-hydration.ts` | Hydration |
| `relay-publish-scope.ts` / `relay-publish-user-copy.ts` | Scope / copy helpers |
| `enhanced-relay-pool-legacy.ts` | Legacy pool — **candidate quarantine** if still publishing |

### C · Real publish / EVENT paths (keep-set · product)

| Path | Role | Policy |
|------|------|--------|
| `transport-kernel/transport-kernel-publish-port.ts` (+ standalone publish modules) | **Canonical gate** — `isTransportKernelPublishOwner` on native | **Keep owner** |
| `relays/hooks/relay-standalone-publish-port*.ts` | Legacy / host-shim routing | Subtract when kernel authority always on |
| `groups/.../local-workspace-relay-publish.ts` | Community workspace publish | **Community PAUSED** — study only |
| `groups/.../sealed-community-relay-publish-retry.ts` | Community sealed retry | **Community PAUSED** |
| `groups/hooks/use-community-relay-pool-writable.ts` | Community writable pool | **Community PAUSED** |

**Working verdict:** Dual-owner “22” is mostly noise + frozen packages. Product dual-owner is **transport-kernel vs legacy standalone publish**, plus **community publish silos** that must not be touched until community un-pause.

---

## Canonical path (target · native)

```
Feature send (DM / non-community)
  → transport-kernel publish owner (isTransportKernelPublishOwner)
    → host/network authority or approved shim (lab only)
      → single WebSocket/EVENT path (parity = packaged)
```

| Concern | Single owner |
|---------|----------------|
| Native relay EVENT | Transport-kernel publish port |
| Legacy standalone | Quarantine → delete after L1 “no fallback” |
| Community sealed / workspace | Siloed under community PAUSED |
| Relay-gateway / mesh packages | Frozen — not PWA lifecycle owners |

---

## Neighbors (must not regress)

| Neighbor | Why |
|----------|-----|
| Transport journal / digest ACTIVE | L3 capture evidence |
| DM send pipeline | Publish success ≠ local persist (dm-persist study) |
| Auth / profile scope | Publish must carry explicit identity, no ambient user |
| Community band | Separate silo — do not “fix publish” via community files |
| Slice 3 Rust `relay::publish_event` / `engine_invoke` | Boundary catalog; collapse only after TS owner is single |

---

## Contract (re-integration)

| Field | Value |
|-------|--------|
| Inputs | Signed event JSON, relay URL(s), `profileId` / capability scope |
| Outputs | Per-relay OK/reject + latency; journal source tag |
| Evidence | Transport digest / `PublishResult` — UI success only with OK |
| Forbidden | Second pool that EVENT-publishes while kernel is owner; Dev Lab–only path as production truth |

---

## Mental simulation — one DM publish

1. User send → encrypt/sign.  
2. Native: `isTransportKernelPublishOwner()` true → kernel path only.  
3. Legacy standalone **not** called.  
4. Relay OK → status update; persist owned by dm-persist path.  
5. Offline relay → fail closed / retry policy — not a second publisher inventing success.

**Failure modes:** Subtract community files “because score 22” while PAUSED; delete mesh packages; leave env-gated host shim as accidental production dual path.

---

## Subtract list (ordered · no code yet)

| # | Action | Risk | Gate |
|---|--------|------|------|
| 1 | **Clarify register** — L1 allowlist: freeze / noise / real publish | Low | Contract test |
| 2 | **Quarantine legacy standalone** when kernel owner always true on Tauri | Med | transport-engine W* contracts + L3 |
| 3 | **Tombstone lab-only shims** from production builds | Med | Env gates fail-closed |
| 4 | Community publish paths | High | **Blocked** until community un-pause + own study |
| 5 | Collapse Rust `relay::publish_event` into `engine_invoke` | High | After TS single owner |

**Order vs dm-persist:** Prefer **dm-persist clarify/dedupe first** (3 heuristic writers, unlocks `db_*` story). Relay clarify (#1) can ship in parallel as docs+L1 only.

---

## Proof plan

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `relay-publish-owner.contract.test.ts` (bucket allowlist) |
| L2 | Existing `transport-kernel-publish-port.test.ts` · transport-engine W* |
| L3 | Parity CDP: publish → journal ACTIVE + relay OK (no Dev Lab) |
| L4 | Two-user DM soak — after dm-persist L3 |

---

## Un-pause charter (maintainer)

Un-pause **`relay-publish` rewrite** for mutate when:

1. This study accepted.  
2. First code slice is clarify (#1) and/or legacy quarantine (#2) — **not** community files.  
3. Community PAUSED remains for C-bucket group paths.  
4. Freeze packages untouched.

---

## Claim language

| May say | Only when |
|---------|-----------|
| Clarified (heuristic) | L1 allowlist green |
| Implemented (legacy quarantine) | Diff matches design; kernel-only on native |
| Fixed (publish) | L3 OK evidence on parity/release |
