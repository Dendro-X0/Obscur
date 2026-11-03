# Investigation — relay-publish dual-path subtraction (relays-only) · complete

**Date (UTC):** 2026-08-04  
**Handoff:** relay-publish dual-path subtraction (design → impl)  
**Parent MRI:** remediate · [codactrl-improvement-findings-2026-07.md](../../docs/program/codactrl-improvement-findings-2026-07.md) § 2026-08-04  
**Prior study:** [relay-publish-dual-owner-integration-study-2026-07.md](./relay-publish-dual-owner-integration-study-2026-07.md) · clarify + legacy quarantine **Implemented**

---

## Session header

```text
NEXT ATOMIC STEP:     relay-publish dual-path subtraction (design → impl, relays-only)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      useConduitMeshRelayPool → conduit-mesh runtime (UI pool)
                      + transport-kernel publish port (native standalone EVENT)
PROOF BEFORE DONE:    Design + L1 owner contracts · Soft L3 already Pass (no re-proof required for taxonomy close)
OUT OF SCOPE:         groups/** · W64 physical legacy deletion (sign-off BLOCKED) · AUTH-SESSION · O-2
```

---

## Classification (2026-08 evidence)

| Candidate (investigation) | Role | Verdict |
|---------------------------|------|---------|
| `use-conduit-mesh-relay-pool.ts` | Product UI pool + Soft L3 `publishToUrls` | **Keep** — canonical pool |
| `use-enhanced-relay-pool-runtime.ts` | `export { useConduitMeshRelayPool as … }` | Alias only — **not** a second writer |
| `use-transport-kernel-relay-pool.ts` | Same alias | Alias only |
| `relay-pool-hook-port.ts` / `use-relay-pool.ts` | Wire to mesh | Canonical port |
| `relay-publish-scope.ts` | URL scope helper | Reader / policy — not EVENT owner |
| `relay-standalone-publish-port*.ts` | Native → kernel; web → browser legacy | Quarantined (2026-07); **W64 delete BLOCKED** |
| `groups/**` community publish hooks | Community EVENT | **Freeze** — PAUSED |

### Mental simulation (Soft L3 / DM)

1. Tester1 send → `dm-relay-transport` → `pool.publishToUrls`  
2. Pool is `useConduitMeshRelayPool` (mesh runtime)  
3. Soft L3 2026-08-04 Pass (`S-POOL-L3-mse746f6`, `fAck=true`) proves this path

No parallel product pool orchestrator remains (RUST-4c deleted `enhanced-relay-pool-legacy.ts`).

---

## Dual-owner claim (CodaCtrl / MRI)

**Heuristic “many use-*-relay-pool writers”** = path-name noise + aliases + freeze packages — same class as dm-persist taxonomy FP.

**Real remaining dual path:** web PWA standalone legacy (`!hasNativeRuntime`) vs native kernel. Physical deletion is **W64**, gated `Decision: BLOCKED` — not this slice.

---

## Subtract list (this slice)

| Action | Item |
|--------|------|
| **Close** | Pool dual-owner as taxonomy FP / already subtracted |
| **Pin L1** | Contract: aliases re-export mesh only; groups freeze; no legacy product orchestrator |
| **Do not** | Delete W64 legacy files · edit `groups/**` · claim “publish dual-owner Fixed” without new L3 |

---

## Status

**Investigation complete** → design → L1 pin
