# Design — Cut 12 Continuity M5 linked-device registry (F-sync C3 NARROW)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **12.0–12.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md) · Cuts 7–11

```text
HANDOFF ATOMIC STEP: Cut 12 Continuity M5 linked-device registry (user continue after Cut 11 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live delta sync
CANONICAL OWNER:     Continuity Plane 3 · linked-device registry · ContinuityDoor
PROOF BEFORE DONE:   per-slice L1; ≠ Continuity Pass · ≠ Soft L3 · ≠ live multi-device sync
SURFACE:             enroll / list / revoke local linked-device registry (+ optional ride in M1 snapshot)
ACK 12.0:            2026-11-10 — proceed 12.1 (user continue; Soft L3 stays paused)
CLOSEOUT:            2026-11-10 — verify:cut12-5 Pass · Continuity Pass not claimed
```

## 1. Why this cut

F-sync C0–C2 landed (M1/M2/M4). C3 = **M5 linked devices + revoke**. Without an enroll/revoke registry, stolen-laptop Continuity cannot be marked revoked and T0 “device enroll list” residue stays empty.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-NO-DEVICE-LIST** | Continuity T0 has no device enroll residue | F-sync T0 incomplete |
| **K-NO-REVOKE** | M4 offer forever; no revoke UI | Stolen device forever risk named in F-sync |
| **K-LIVE-SYNC-JUMP** | Temptation to ship MLS/Sesame deltas day one | Out of NARROW; Continuity Pass bait |

**Not this cut:** Continuity Pass · Soft L3 Fixed · live delta fan-out · WebRTC pair pipe · Tor Verified · Matrix promote.

## 2. Goal

1. **Local linked-device registry** — deviceId · label · enrolledAt · revokedAt.  
2. **Enroll this device / revoke by id** via Continuity ports + door.  
3. **Optional ride** in Continuity M1 snapshot as `linkedDevices` (T0 residue).  
4. Honest copy: registry ≠ live sync · Soft L3 paused · **≠ Continuity Pass**.

## 3. Deliver

| Slice | Deliver | Proof |
|-------|---------|-------|
| **12.0** | Design ACK | continue ACK · **DONE 2026-11-10** |
| **12.1** | Linked-device registry module + storage | L1 · **DONE** (`verify:cut12-1`) |
| **12.2** | ContinuityPorts enroll/list/revoke | L1 · **DONE** (`verify:cut12-2`) |
| **12.3** | Vite ports + M1 snapshot optional field | L1 · **DONE** (`verify:cut12-3`) |
| **12.4** | ContinuityDoor M5 UI | L1 · **DONE** (`verify:cut12-4`) |
| **12.5** | Lab checklist · **≠ Continuity Pass** | Soak · **DONE** (`verify:cut12-5`) |

## 4. Law

```text
1. Registry is Continuity T0 residue — not Soft L3 CRM invent.
2. Revoke marks revokedAt; does not wipe other devices' local disks (honesty).
3. Live multi-device delta sync remains out of scope — ≠ Continuity Pass.
4. Soft L3 / Tor / Matrix stay paused.
5. No apps/pwa mega-import.
```

## 5. Non-goals

- Continuity Pass  
- Soft L3 Fixed  
- Live encrypted delta fan-out  
- Background auto-enroll of every browser fingerprint  

## 6. Proof

| Layer | Done |
|-------|------|
| **L1** | Registry + ports + door contracts · **Pass** (`pnpm verify:cut12-5`) |
| **L2+** | Optional dual-device revoke soak |

## 7. References

- F-sync C3 — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- Cut 8 M1 snapshot — `continuity-m1-snapshot.ts`  
