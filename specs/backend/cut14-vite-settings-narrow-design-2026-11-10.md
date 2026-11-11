# Design — Cut 14 Vite Settings NARROW (T2 residue + thin Settings door)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **14.0–14.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** Cuts 11–13 · [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md) · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 14 Vite Settings NARROW (user continue after Cut 13 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live delta sync · peer history grants · apps/pwa Settings mega-import
CANONICAL OWNER:     apps/desktop-ui SettingsDoor · Continuity T2 residue (relayList / privacy / ui)
PROOF BEFORE DONE:   per-slice L1; ≠ Continuity Pass · ≠ Soft L3 · ≠ full Next Settings
SURFACE:             thin Settings door · persist T2 residue · ride in Continuity M1 export/import
ACK 14.0:            2026-11-10 — proceed 14.1 (user continue; Soft L3 stays paused)
CLOSEOUT:            2026-11-10 — verify:cut14-5 Pass · Continuity Pass not claimed
```

## 1. Why this cut

Vite product face can create identity (Cut 11) and run Continuity M1–M6 (Cuts 7–13), but **T2 settings residue is always empty** on sealed export (`relayList: []`, `privacySettings: {}`, `uiSettings: {}`) and there is **no Settings door** — only Private home + Continuity stacked under chat.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-EMPTY-T2** | M1 export always empty T2 slots | Continuity honesty / F-sync T2 incomplete |
| **K-NO-SETTINGS** | No Settings surface on Vite face | Product-depth gap named after Cut 11 |
| **K-PWA-BAIT** | Temptation to import apps/pwa Settings | Mega-import / dual owner |

**Not this cut:** Soft L3 Fixed · Continuity Pass · peer history grants · live M5 deltas · Tor Verified · Matrix promote · full Next Settings parity.

## 2. Goal

1. **Local Vite settings residue** — displayName · relayList · privacySettings · uiSettings.  
2. **Ride in Continuity M1** export/import (T2 slots filled from residue).  
3. **Thin SettingsDoor** — Identity · Network · Privacy honesty panels.  
4. Soft L3 / Tor / Matrix stay **paused** · **≠ Continuity Pass**.

## 3. Deliver

| Slice | Deliver | Proof |
|-------|---------|-------|
| **14.0** | Design ACK | continue ACK · **DONE 2026-11-10** |
| **14.1** | Settings residue module + storage | L1 · **DONE** (`verify:cut14-1`) |
| **14.2** | Continuity M1 vite ports read/write T2 | L1 · **DONE** (`verify:cut14-2`) |
| **14.3** | SettingsDoor UI | L1 · **DONE** (`verify:cut14-3`) |
| **14.4** | Wire PrivateTrustHome | L1 · **DONE** (`verify:cut14-4`) |
| **14.5** | Lab checklist · **≠ Continuity Pass** | Soak · **DONE** (`verify:cut14-5`) |

## 4. Law

```text
1. Settings residue is Continuity T2 / product face — not Soft L3 CRM invent.
2. Relay list is local residue only — ≠ live mesh / Tor Verified claim.
3. No apps/pwa Settings mega-import.
4. Soft L3 / Tor / Matrix stay paused · ≠ Continuity Pass.
5. Peer history grants remain out of scope.
```

## 5. Non-goals

- Continuity Pass  
- Soft L3 Fixed  
- Peer history grants UI  
- Live multi-device delta sync  
- Full Next/pwa Settings surface  

## 6. Proof

| Layer | Done |
|-------|------|
| **L1** | Residue + Continuity T2 wire + SettingsDoor contracts · **Pass** (`pnpm verify:cut14-5`) |
| **L2+** | Optional operator Settings→export inventory soak |

## 7. References

- Cut 11 product-depth — `cut11-vite-product-depth-design-2026-11-10.md`  
- Continuity M1 snapshot T2 — `continuity-m1-snapshot.ts`  
- F-sync T2 — `20-cross-device-profile-sync-e2ee.md`  
