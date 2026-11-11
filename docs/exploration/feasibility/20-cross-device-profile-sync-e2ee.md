# Feasibility — Cross-device profile data sync (decentralized E2EE)

**ID:** F-sync  
**Status:** draft · **Cut 13 CLOSED** (C0–C4 NARROW: M1 file · M2 home · M4 pair · M5 registry · M6 opaque home backfill L1) · live delta sync + peer grants still open · still ≠ Continuity Pass  
**Date (UTC):** 2026-11-10  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-hub · F-auth-schemes-solution · F-PSE · F-rel-discover · F-groups · F-netconfig  
**In-repo Continuity:** `auth-continuity-audience-deliberation-2026-11.md` (Plane 3) · `cross-device-data-continuity-design-2026-10.md` · `continuity-pioneering-design-2026-11.md`  
**Impl cut:** `specs/backend/cut13-continuity-m6-home-backfill-design-2026-11-10.md` (M6) · Cut 12 M5 · Cut 10 M4 · Cut 9 M2 · Cut 8 M1  
**Claim language:** **explored methods** ≠ Continuity Pass · ≠ unlock recreates history · ≠ custodial sync · Soft L3 stays paused

## 1. Scope

- **In:** Convenient **yet secure** ways to sync **profile / workspace data** across devices for a decentralized E2EE app — without a mainstream “logged-in cloud account” as root.
- **Out:** Claiming Continuity Pass; collapsing Plane 3 into daily password unlock; OAuth-as-root sync; Soft L3 Fixed.  
  **In-band now:** C0–C4 NARROW landed (M1–M4 + M5 registry + M6 opaque home backfill); live M5 deltas + peer grants + M7 still open.

**Profile data** here means the workspace bundle: identity binding material (wrapped), settings, relationship graph, conversation indexes, vault manifests, group memberships, named network homes — **not** “whatever the public relay still has.”

## 2. Basics — convenience vs security

| Constraint | Implication |
|------------|-------------|
| E2EE + self-custody | Sync **ciphertext** (or pairwise re-encrypt); operator must not read plaintext |
| No central CRM server | Graph/history authority stays local + optional **blind** blob store |
| Unlock ≠ Continuity | Device password opens *this* machine; cross-device needs an explicit Plane 3 path |
| Multi-device live | Harder than backup/restore; needs device enrollment + per-device keys (Sesame / MLS-like) |

**Honest UX promise:** “New device → recover identity → choose sync method → see progress (`empty | restoring | partial | full`).” Never imply password alone recreates a wiped PC.

### What must sync (priority tiers)

| Tier | Data | Sync criticality |
|------|------|------------------|
| **T0** | Wrapped identity + device enroll list | Required to be “you” |
| **T1** | Relationship graph + blocks/tombstones | Social correctness (F16) |
| **T2** | Settings, network homes, protocol app toggles | Convenience |
| **T3** | Message bodies / indexes | Chat continuity |
| **T4** | Vault media CAS | Heavy; often lazy fetch |

## 3. Capabilities map — methods

| ID | Method | How it works | Convenience | Security | Feasibility for Obscur |
|----|--------|--------------|-------------|----------|------------------------|
| **M1** | **Encrypted portable file** | Export sealed bundle → USB/cloud-of-user’s-choice → import | Medium | High (user holds blob) | **High — keep / strengthen** (as-built path) |
| **M2** | **Encrypted backup to own DC / VPS** | Same sealed payload published to **user/operator home** (F-groups game server) | High | High if DC untrusted for plaintext | **High — preferred always-on** |
| **M3** | **Encrypted backup on public relays** | Sealed account events on Nostr-class relays | Medium | Metadata + availability risk; ciphertext OK if AEAD sound | **Med — optional**, never sole private-trust path |
| **M4** | **Device-to-device transfer** | Old device QR/LAN/pair → stream sealed state (Signal-like transfer) | High when both present | High (short channel) | **High for desktop↔phone** |
| **M5** | **Live multi-device (linked devices)** | Enroll device B; fan-out encrypted deltas; primary may backfill attachments | Highest daily UX | Needs device list, revoke, per-device sessions | **Med — staged after M1/M2/M4** |
| **M6** | **Peer / group reconstitution** | Re-fetch entitled history from peers/DCs after identity restore | Medium | Depends on peers online + ACL | Complements M1–M5 (living-graph idea) |
| **M7** | **OPAQUE / SVR-style PIN vault** | Blind server holds envelope; rate-limited PIN unwrap | High “forgot file” UX | Needs trusted/blind infra (SVR2-class) | **Lab-only** until Continuity server chartered |
| **M8** | **Custodial cloud sync** | Google/iCloud plaintext or provider keys | Highest | Low for threat model | **`reject-for-core`** |
| **M9** | **Relay lookback as sync** | Rebuild CRM/chat from public history | Feels automatic | Wrong + Soft L3 failure mode | **`reject-for-core`** |

### Recommended stack (convenient *and* secure)

```text
Daily convenience     Security spine
─────────────────     ─────────────────────────────
M4 when both devices  +  M1 file always available
M2 auto to own DC     +  T0–T2 in every sealed backup
M5 later (linked)     +  explicit enroll/revoke UI
M6 fills gaps         +  never M8/M9
```

**Private-trust default:** auto **M2** to the user’s named home (F-netconfig) + manual **M1**. Public-relay **M3** is an advanced opt-in with metadata warnings.

## 4. Fit to planes

| Plane | Sync role |
|-------|-----------|
| Auth (1–2) | Unlock/recover **local** capability; may unwrap backup DEK after restore |
| Profile | Per-workspace sync; hard isolation — no cross-profile merge |
| Storage | Sealed SQLite dump / incremental snapshots + CAS manifests |
| Relationship | Graph in T1 payload — not reconstructed from DMs |
| Message | T3 bodies from backup and/or M6 peer/DC pull |
| Transport | Carries **opaque** backup blobs or device-pair channels only |

### Crypto sketch (normative intent, not impl)

1. Backup DEK random; wrapped by recovery secret (password-derived +/or recovery file key).  
2. Payload = AEAD(workspace snapshot slices).  
3. Optional second wrap for “restore with passkey” (F-auth-schemes W) without IdP.  
4. Live multi-device: each device has a device key; deltas sealed to device pubkeys; revoke = stop wrapping for that device + session reset.

## 5. Libraries / stacks

| Area | Notes |
|------|-------|
| As-built | `encrypted-account-backup-service` · portable bundle · empty-device continuity gate |
| Gap named in deliberation | Backup publish must eventually cover **SQLite bodies**, not chat-state-only |
| Research parallels | Signal Secure Backups + device transfer; SVR2 PIN vault; MLS multi-device enrollment patterns |
| Blind infra | OPAQUE (F-auth-schemes O) only with explicit Continuity-server threat model |

## 6. Feasibility verdict

`fit-with-adapter` — Cross-device sync is feasible for Obscur as **Plane 3 Continuity** using **sealed backups + own-DC publish + device pairing**, with **live linked devices** as a later cut. Convenience comes from automation and UX honesty; security comes from client-side encryption and rejecting custodial/lookback “sync.”

| Phase | Ship |
|-------|------|
| **C0** | M1 file round-trip complete (T0–T2 + honest T3 partial) |
| **C1** | M2 auto backup to named private home + restore wizard |
| **C2** | M4 device-to-device transfer |
| **C3** | M5 linked devices + revoke — **Cut 12 CLOSED** (registry enroll/list/revoke L1; **≠ live delta sync**) |
| **C4** | M6 peer/DC backfill — **Cut 13 CLOSED** (opaque home envelopes L1) · peer grants — **Cut 15 CLOSED** (Ingredient 5 opaque offer/accept L1; **≠ invent CRM**) · optional M3/M7 + live M5 deltas still open |

`reject-for-core` — M8 custodial sync as product spine; M9 history-as-CRM sync.

## 7. Risks / traps

- Marketing “sync” while backup omits SQLite (known gap).  
- Auto M3 to public relays for private family graphs (metadata).  
- Linking devices without revoke UI (stolen laptop forever).  
- Merging Continuity into AuthGateway polish.  
- Deduplicating ciphertext on a shared host in ways that leak attachment equality (Signal notes this class of trade-off).

## 8. Open questions

1. Default auto-backup home: require user to pick a DC on first unlock, or ship reference blind bucket?  
2. Incremental vs daily full snapshot (Signal-style daily archive)?  
3. Should vault media (T4) ever ride in the core backup, or always lazy CAS fetch?  
4. Multi-device: primary/secondary roles or equal peers?  
5. Recovery key UX: 64-char code vs password-wrapped file vs both?

## 9. References

- `specs/backend/auth-continuity-audience-deliberation-2026-11.md`  
- `specs/backend/cross-device-data-continuity-design-2026-10.md`  
- `specs/backend/continuity-pioneering-design-2026-11.md`  
- `docs/exploration/feasibility/15b-auth-schemes-solution-record.md`  
- `docs/exploration/feasibility/18-community-group-systems.md` (DC as backup home)  
- Signal Secure Backups / device transfer (external parallel)  
- Signal SVR2 (external — rate-limited PIN vault research)  
