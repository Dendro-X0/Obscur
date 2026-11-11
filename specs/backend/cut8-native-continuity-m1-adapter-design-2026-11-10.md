# Design — Cut 8 native Continuity M1 adapter (Vite sealed T0–T2)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **8.0–8.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** [cut7-continuity-m1-sealed-file-design-2026-11-10.md](./cut7-continuity-m1-sealed-file-design-2026-11-10.md) · [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md) · Cuts 0–7

```text
HANDOFF ATOMIC STEP: Cut 8 native Continuity M1 adapter (user continue after Cut 7 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live multi-device (M5)
CANONICAL OWNER:     Continuity Plane 3 · apps/desktop-ui vite Continuity ports (no apps/pwa import)
PROOF BEFORE DONE:   per-slice L1; optional L2 file round-trip; ≠ Continuity Pass · ≠ Soft L3
SURFACE:             Vite-native sealed Continuity M1 (T0–T2); full EncryptedAccountBackupPayload deferred
ACK 8.0:             2026-11-10 — proceed 8.1 (user continue; Soft L3 stays paused)
```

## 1. Why this cut (after Cut 7)

Cut 7 shipped Continuity **law + inventory + Vite door with lab stub**. Export/import still refused with “use Next Settings.” Production Vite face therefore has a Continuity panel that cannot complete F-sync C0 file round-trip without the Next mega-app.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-LAB-STUB-DOOR** | ContinuityDoor wired; ports always `lab_stub` | C0 M1 not closable on Vite product face |
| **K-PWA-MEGA-IMPORT** | Temptation to import `encrypted-account-backup-service` into desktop-ui | Violates Cut 3/4 fence; pulls chat-state CRM surface |
| **K-UNLOCK-EQ-CONT** | Still live risk | Unlock must stay separate; Continuity passphrase is Plane 3 |

**Not this cut:** Continuity Pass · Soft L3 Fixed · M2 auto-DC · M4 pair · M5 · full Next payload parity · Tor Verified · Matrix promote.

## 2. Goal

Ship a **NARROW Vite-native Continuity M1 adapter**:

1. **Sealed snapshot** — `obscur.continuity_m1.v1` plaintext + `obscur.continuity_m1.sealed.v1` PBKDF2-SHA256-AES-GCM envelope (Continuity passphrase).  
2. **T0–T2 present** in every successful export (empty arrays/objects OK; inventory honesty stays honest).  
3. **No `apps/pwa` imports** — duplicate storage key conventions only (`obscur.identity.record::*`, `obscur.peer_trust.v1.*`).  
4. **Prefer-native resolve** — lab stub only when `OBSCUR_DESKTOP_UI_LAB_STUBS=1` or host absent (same selection spine as Cuts 4–6).  
5. Soft L3 / Tor / Matrix stay **paused**. **≠ Continuity Pass**.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **8.0** | This design **ACK** | Maintainer/continue ACK · **DONE 2026-11-10** |
| **8.1** | Continuity M1 snapshot + seal/unseal (AES-GCM) | L1 · **DONE** (`verify:cut8-1`) |
| **8.2** | `createViteContinuityPorts` — localStorage T0/T1 (+ empty T2 slots) export/import | L1 · **DONE** (`verify:cut8-2`) |
| **8.3** | `resolveDesktopUiContinuityPorts` prefer-native | L1 · **DONE** (`verify:cut8-3`) |
| **8.4** | Wire App + ContinuityDoor passphrase/file UX | L1 · **DONE** (`verify:cut8-4`) |
| **8.5** | Lab checklist — native M1 round-trip soak · **≠ Continuity Pass** | Soak doc · **DONE** (`verify:cut8-5`) |

## 4. Continuity M1 v0 law (additive to Cut 7)

```text
1. Continuity passphrase wraps the sealed file (Plane 3) — not daily unlock alone.
2. Export may use device passphrase only to unwrap local identity into the sealed plaintext.
3. Import installs identityUnlock re-wrapped with Continuity passphrase as the new device password.
4. T3/T4 omitted → honesty stays partial (never claim full / Continuity Pass).
5. chat-state must not mint CRM (Cut 7.3 still holds; this adapter does not carry chat-state).
6. No apps/pwa feature imports into desktop-ui.
```

## 5. Snapshot shape (Vite-native, not full Next payload)

```text
ContinuityM1Snapshot
  version: 1
  format: "obscur.continuity_m1.v1"
  createdAtUnixMs
  publicKeyHex
  identityUnlock { encryptedPrivateKey, username? }   // T0 — Continuity-passphrase wrapped
  profile { username? }                               // T0
  peerTrust { acceptedPeers[], mutedPeers[] }         // T1
  privacySettings {} | object                         // T2 slot
  relayList [] | entries                              // T2 slot
  uiSettings {} | object                              // T2 slot
```

Sealed envelope: PBKDF2 (SHA-256) → AES-GCM-256 · salt/iv random · iterations fixed in module.

## 6. Non-goals

- Continuity Pass product claim  
- Soft L3 contact Pass / dual CDP  
- Full `EncryptedAccountBackupPayload` / NIP-44 portable bundle parity  
- M2/M4/M5/M7/M8/M9  

## 7. Proof plan

| Layer | Cut 8 “done” |
|-------|----------------|
| **L1** | Seal round-trip · vite ports · resolve · App wire contracts |
| **L2** | Optional export→wipe→import on desktop |
| **L3** | Optional dual-device file handoff (**not** Soft L3) |
| **L4** | Optional packaged Continuity door |

## 8. Risks

- Agents claim Continuity Pass from green vitest.  
- Smuggling chat-state / Soft L3 lookback into vite snapshot.  
- Importing pwa backup service “for parity.”  

## 9. References

- Cut 7 — `cut7-continuity-m1-sealed-file-design-2026-11-10.md`  
- F-sync — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- Vite identity — `apps/desktop-ui/src/auth/vite-passphrase-device-unlock.ts`  
