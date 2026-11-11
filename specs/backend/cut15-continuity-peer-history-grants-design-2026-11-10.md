# Design — Cut 15 Continuity peer history grants (Ingredient 5 NARROW)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **15.0–15.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** [continuity-pioneering-design-2026-11.md](./continuity-pioneering-design-2026-11.md) · Cuts 7–14 · [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md)

```text
HANDOFF ATOMIC STEP: Cut 15 Continuity peer history grants (user continue after Cut 14 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live delta sync
CANONICAL OWNER:     Continuity Plane 3 · peer history grants · ContinuityDoor
PROOF BEFORE DONE:   per-slice L1; ≠ Continuity Pass · ≠ Soft L3 invent CRM · ≠ identity key recovery
SURFACE:             create/accept/list peer history grant offers (opaque residue only)
ACK 15.0:            2026-11-10 — proceed 15.1 (user continue; Soft L3 stays paused)
CLOSEOUT:            2026-11-10 — verify:cut15-5 Pass · Continuity Pass not claimed
```

## 1. Why this cut

F-sync C4 / Ingredient 5 names **peer history grants** after M6 home backfill. Without a grant offer/accept residue, wiped-device recovery still depends only on own SCU/home — social continuity stays design-only.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-NO-PEER-GRANT** | ContinuityDoor has M1–M6 only | Ingredient 5 gap |
| **K-CRM-FROM-GRANT** | Temptation to invent Soft L3 trust from grant | Soft L3 invent |
| **K-PASS-CLAIM** | Grant ≠ Continuity Pass bait | Must stay NARROW |

**Not this cut:** Continuity Pass · Soft L3 Fixed · live M5 deltas · identity-key social recovery · group steward policy UI · Tor Verified · Matrix promote.

## 2. Goal

1. **Peer grant offer** — recipient pubkey hint · opaque history JSON · short code · TTL (sneakernet).  
2. **Accept** stores grant as Continuity residue — **does not invent CRM**.  
3. **List** local outgoing/incoming grants.  
4. Honest copy: grant ≠ Soft L3 invent · ≠ Continuity Pass · Soft L3 paused.

## 3. Deliver

| Slice | Deliver | Proof |
|-------|---------|-------|
| **15.0** | Design ACK | continue ACK · **DONE 2026-11-10** |
| **15.1** | Grant offer create/parse/verify + registry | L1 · **DONE** (`verify:cut15-1`) |
| **15.2** | ContinuityPorts create/accept/list | L1 · **DONE** (`verify:cut15-2`) |
| **15.3** | Vite + lab ports wire | L1 · **DONE** (`verify:cut15-3`) |
| **15.4** | ContinuityDoor peer-grant UI | L1 · **DONE** (`verify:cut15-4`) |
| **15.5** | Lab checklist · **≠ Continuity Pass** | Soak · **DONE** (`verify:cut15-5`) |

## 4. Law

```text
1. Grant payload is opaque history residue — not identity key custody.
2. Accept does not invent Soft L3 trust / CRM edges from grant bodies.
3. Live multi-device delta sync remains out of scope — ≠ Continuity Pass.
4. Soft L3 / Tor / Matrix stay paused.
5. No apps/pwa mega-import.
```

## 5. Non-goals

- Continuity Pass  
- Soft L3 Fixed  
- Forced social recovery of identity keys  
- Live encrypted delta fan-out  
- Group steward policy UI  

## 6. Proof

| Layer | Done |
|-------|------|
| **L1** | Grant module + ports + door contracts · **Pass** (`pnpm verify:cut15-5`) |
| **L2+** | Optional dual-device grant soak |

## 7. References

- Ingredient 5 — `continuity-pioneering-design-2026-11.md`  
- Cut 10 M4 offer pattern — `continuity-m4-offer.ts`  
- Cut 13 M6 opaque envelopes — `continuity-m6-backfill.ts`  
