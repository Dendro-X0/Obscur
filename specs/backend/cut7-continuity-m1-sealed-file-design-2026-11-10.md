# Design — Cut 7 Continuity M1 sealed-file spine (F-sync C0)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **7.0–7.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md) · [auth-continuity-audience-deliberation-2026-11.md](./auth-continuity-audience-deliberation-2026-11.md) · [cross-device-data-continuity-design-2026-10.md](./cross-device-data-continuity-design-2026-10.md) · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md) · Cuts 0–6

```text
HANDOFF ATOMIC STEP: Cut 7 CLOSED (7.0–7.5 L1 + checklist) — Continuity Pass still not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live multi-device (M5)
CANONICAL OWNER:     Continuity / account-sync Plane 3 · sealed portable bundle · desktop-ui Continuity door
PROOF BEFORE DONE:   per-slice L1; optional L2 file round-trip; ≠ Continuity Pass · ≠ Soft L3
SURFACE:             M1 sealed file (F-sync C0); M2/M4/M5 deferred
ACK 7.0:             2026-11-10 — proceed 7.1 (user GO with F-sync open; Soft L3 stays paused)
```

## 1. Why this cut (after Cuts 0–6)

Rewrite band shipped private-trust authority + Vite desktop face. **Plane 3 Continuity** remains specs + Next-only as-builts. F-sync names **C0 = M1 file round-trip** (T0–T2 + honest T3 partial) as the first shippable Continuity wedge.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-UNLOCK-EQ-CONT** | Users/agents treat password unlock as history restore | Lies; deliberation forbids collapsing Plane 3 into Planes 1–2 |
| **K-BACKUP-CHATSTATE** | Portable publish still chat-state-primary for bodies | Dual authority vs Cut 0/1 SQLite / `relationship_edge` |
| **K-M9-LOOKBACK** | Empty-device “restore from relays” can feel like CRM-from-history | Soft L3 failure mode; reject as Continuity spine |
| **K-NO-TIER-LABEL** | Export/import UX does not name empty/partial/full | Dishonest Continuity progress |
| **K-VITE-NO-DOOR** | Production Vite shell has no Continuity entry | Cut 5 made Vite the desktop face without Plane 3 |

**Not this cut:** Continuity Pass · Soft L3 Fixed · M2 auto-DC · M4 pair · M5 linked devices · M7 SVR · custodial M8 · deleting Next backup UI day one · Tor Verified · Matrix promote.

## 2. Goal

Ship a **NARROW Continuity M1 spine**:

1. **Law** — unlock ≠ Continuity; M8/M9 rejected; tiers T0–T4 named.  
2. **Sealed file** remains the C0 carrier (strengthen, don’t invent a third architecture).  
3. **Honest restore status** — `empty | restoring | partial | full` (F-sync UX promise).  
4. **Authority lean** — T1 prefers sticky CRM / `relationship_edge` evidence over inventing TRUSTED from message lookback.  
5. Soft L3 / Tor / Matrix stay **paused**. **≠ Continuity Pass** even when M1 L1/L2 green.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **7.0** | This design **ACK** | Maintainer/GO ACK · **DONE 2026-11-10** |
| **7.1** | Continuity M1 law contracts — tiers · reject M8/M9 · unlock ≠ Continuity · Soft L3 paused | L1 · **DONE** (`verify:cut7-1`) |
| **7.2** | Sealed snapshot inventory — T0–T2 required fields; T3/T4 explicit optional/partial | L1 · **DONE** (`sealed-snapshot-inventory` · `verify:cut7-2`) |
| **7.3** | Prefer native/SQLite evidence for T3 when Tauri; refuse chat-state-as-sole CRM | L1 · **DONE** (`CHAT_STATE_AS_SOLE_CRM_REFUSED` · `verify:cut7-3`) |
| **7.4** | Vite Continuity door (export/import + status) — thin client of ports; Next Settings may remain | L1 · **DONE** (`ContinuityDoor` · lab ports · `verify:cut7-4`) |
| **7.5** | Lab checklist — M1 file round-trip soak · **≠ Continuity Pass** | Soak doc · **DONE** (`verify:cut7-5`) |

## 4. Continuity law (Cut 7)

```text
1. Unlock opens this device only — never implies wiped-PC reconstitution.
2. M1 sealed file is C0 spine; M2/M4 additive later; M5 later; M8/M9 reject-for-core.
3. T0–T2 must be representable in every M1 export; T3 may be partial; T4 lazy/out-of-band.
4. Sticky CRM / relationship_edge wins over history-as-contacts (no Soft L3 lookback spine).
5. Claiming Continuity Pass / Soft L3 Fixed / Tor Verified / Matrix promote is forbidden in this cut.
6. apps/pwa Continuity UI may remain until Vite door lands — no silent wipe of backup paths.
```

## 5. Tier map (F-sync)

| Tier | Must in C0 M1 | Honesty |
|------|---------------|---------|
| **T0** Wrapped identity + device/enroll residue | Yes | Missing → not “you” |
| **T1** Relationship graph + blocks/tombstones | Yes | Prefer sticky CRM / edges |
| **T2** Settings, network homes, protocol toggles | Yes | Convenience |
| **T3** Message bodies / indexes | Partial OK | Label `partial` if sparse |
| **T4** Vault media CAS | Out of band OK | Lazy fetch; not required for C0 Pass claim (and we claim none) |

## 6. Non-goals

- Continuity Pass product claim  
- Soft L3 contact Pass / dual CDP  
- Live multi-device enroll/revoke (M5)  
- OPAQUE/SVR Continuity server (M7)  
- Custodial cloud sync (M8)  
- Relay lookback as CRM (M9)  

## 7. Proof plan

| Layer | Cut 7 “done” |
|-------|----------------|
| **L1** | Law + inventory + authority contracts · Vite door contracts |
| **L2** | Optional export→wipe→import M1 round-trip on desktop |
| **L3** | Optional dual-device file handoff (**not** Soft L3 matrix) |
| **L4** | Optional packaged installer Continuity door |

## 8. Risks

- Agents claim Continuity Pass from green vitest.  
- Expanding M1 into M5 mid-cut.  
- Re-centering chat-state as CRM truth.  
- Soft L3 resume smuggled via “restore from relays.”  

## 9. References

- F-sync — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- As-built — `encrypted-account-backup-service` · `unified-account-export-service` · empty-device gate  
- Pioneering (deferred north star) — `continuity-pioneering-design-2026-11.md` · **not** C0 scope  
