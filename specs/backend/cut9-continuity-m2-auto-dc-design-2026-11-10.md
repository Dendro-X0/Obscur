# Design — Cut 9 Continuity M2 auto-DC (F-sync C1)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **9.0–9.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md) · [cut8-native-continuity-m1-adapter-design-2026-11-10.md](./cut8-native-continuity-m1-adapter-design-2026-11-10.md) · Cuts 0–8

```text
HANDOFF ATOMIC STEP: Cut 9 Continuity M2 auto-DC (user continue after Cut 8 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5 linked devices
CANONICAL OWNER:     Continuity Plane 3 · private-dc Continuity backup client · desktop-ui Continuity door
PROOF BEFORE DONE:   per-slice L1; optional L2 against lab /v1; ≠ Continuity Pass · ≠ Soft L3
SURFACE:             publish/restore sealed Continuity M1 to named private home (opaque blob)
ACK 9.0:             2026-11-10 — proceed 9.1 (user continue; Soft L3 stays paused)
```

## 1. Why this cut (after Cut 8)

Cut 8 closed F-sync **C0** (M1 file). F-sync C1 = **M2 auto backup to named private home**. Vite Continuity door can seal a file but cannot yet publish/restore that sealed blob to the operator’s private DC.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-M1-ONLY** | File download/import only | Misses F-sync preferred always-on path |
| **K-DM-AS-BACKUP** | Temptation to shove backups into random DM threads | Wrong authority; Continuity ≠ chat |
| **K-PWA-MEGA** | Next account-sync relay publish | Not Vite-native; Soft L3 lookback risk |

**Not this cut:** Continuity Pass · Soft L3 Fixed · auto-on-every-unlock scheduler · M3 public relays · M4/M5 · Tor Verified · Matrix promote.

## 2. Goal

Ship a **NARROW Continuity M2 spine**:

1. **Opaque Continuity backup** on private DC — server never sees plaintext snapshot.  
2. **Reuse Cut 8 sealed envelope** (`obscur.continuity_m1.sealed.v1`) as the blob.  
3. **Manual publish + restore-from-home** in ContinuityDoor (auto-schedule deferred).  
4. **Lab `/v1/continuity/backups`** routes for L1/L2 without inventing a second crypto format.  
5. Soft L3 / Tor / Matrix stay **paused**. **≠ Continuity Pass**.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **9.0** | This design **ACK** | Maintainer/continue ACK · **DONE 2026-11-10** |
| **9.1** | Home Continuity backup client (put/fetch latest) in `@obscur/private-trust-engine` | L1 · **DONE** (`verify:cut9-1`) |
| **9.2** | Lab server Continuity backup routes | L1 · **DONE** (`verify:cut9-2`) |
| **9.3** | Vite Continuity ports — publish/restore via home session | L1 · **DONE** (`verify:cut9-3`) |
| **9.4** | ContinuityDoor M2 actions + App wire honesty | L1 · **DONE** (`verify:cut9-4`) |
| **9.5** | Lab checklist · **≠ Continuity Pass** | Soak · **DONE** (`verify:cut9-5`) |

## 4. Continuity M2 law (additive)

```text
1. Home stores opaque sealed Continuity M1 only — never plaintext identity/CRM.
2. Continuity passphrase still required to unseal after fetch (Plane 3).
3. Unlock ≠ Continuity; home presence ≠ Continuity Pass.
4. Dedicated /v1/continuity/backups — do not overload DM conversation threads as CRM.
5. Soft L3 / Tor / Matrix / Continuity Pass remain unclaimed.
6. No apps/pwa Continuity mega-import into desktop-ui.
```

## 5. Wire sketch

```text
POST /v1/continuity/backups
  { publicKeyHexHint, sealedEnvelopeJson, clientBackupId }
  → { backup: { id, publicKeyHexHint, acceptedAtUnixMs, status: "accepted" } }

GET /v1/continuity/backups/latest?publicKeyHexHint=...
  → { backup: null | { id, publicKeyHexHint, sealedEnvelopeJson, acceptedAtUnixMs } }
```

## 6. Non-goals

- Continuity Pass product claim  
- Soft L3 Fixed / dual CDP  
- Background auto-publish on timer (charter later)  
- M3 public-relay Continuity  
- Full EncryptedAccountBackupPayload on DC  

## 7. Proof plan

| Layer | Cut 9 “done” |
|-------|----------------|
| **L1** | Client + lab routes + vite ports + door contracts |
| **L2** | Optional live lab server publish→fetch→import |
| **L3** | Optional dual-device home Continuity (**not** Soft L3) |
| **L4** | Optional packaged |

## 8. Risks

- Agents claim Continuity Pass from green vitest.  
- Storing plaintext in home “for convenience.”  
- Soft L3 resume smuggled via “restore from relays.”  

## 9. References

- F-sync C1 — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- Cut 8 — `cut8-native-continuity-m1-adapter-design-2026-11-10.md`  
- H-dc client — `packages/obscur-private-trust-engine/src/private-dc-home-client.ts`  
