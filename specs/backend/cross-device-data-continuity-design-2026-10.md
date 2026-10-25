# Design — Cross-device / cross-platform data continuity

**Date (UTC):** 2026-10-25  
**Status:** Design · P0 implementing (empty-device continuity gate)  
**Parents:** [network-contacts-new-device-empty-investigation-2026-10.md](./network-contacts-new-device-empty-investigation-2026-10.md) · [native-account-sync-phase-machine-design-2026-10.md](./native-account-sync-phase-machine-design-2026-10.md) · portability Segment J  
**Charter ask:** Preserve contacts, chat history, and media across devices/platforms without Soft L3 dual-window or greenfield sync stack.

---

```text
HANDOFF ATOMIC STEP: P0 empty-device continuity gate landed — L2 restore smoke next when asked
PAUSED / CANCELLED: Soft L3 · Matrix · Tor Verified · video usable · Nostr-client identity · greenfield CRDT mesh
CANONICAL OWNER: encrypted-account-backup-service + portable bundle + SQLite evidence · future Rust phase machine
PROOF BEFORE DONE (P0): L1 heuristic green · empty unlock shows gate · Restore uses manual intent
SURFACE: desktop + mobile shell + web (capability-gated)
```

## Product contract (what “success” means)

A user who unlocks the **same identity** on a new device/platform must be able to recover:

| Domain | Must survive | Acceptable lag |
|--------|--------------|----------------|
| Contact list (`peerTrust` / projection contacts) | Yes | Seconds–minutes after restore |
| DM / request graph + chat bodies | Yes (best effort; SQLite-native truth on Tauri) | After restore apply |
| Relays, privacy, UI settings | Yes | With restore |
| Community membership / room keys | Yes when present in backup | With restore |
| Vault / attachment **bytes** | Best effort | May require re-fetch from CAS / local media path; not guaranteed in NIP-44 blob |

**Not** the contract: live multi-writer Soft L3 dual windows; anonymous disposable sessions; inventing a third protocol.

## Architecture — two complementary transports (already exist)

```text
                    ┌─────────────────────────────┐
   Device A         │  EncryptedAccountBackup     │         Device B
   (publish)  ──►   │  payload v1 (NIP-44 /      │  ──►   (restore)
                    │  portable file)             │
                    └─────────────────────────────┘
                              ▲
                              │
              ┌───────────────┴────────────────┐
              │                                │
     Path R — Relay                    Path L — Local file
     encrypted backup on               portable account bundle
     user relays (online)              export/import (offline OK)
```

Both paths share **one payload owner**: `encrypted-account-backup-service` (`EncryptedAccountBackupPayload` v1).

### Payload domains (today)

| Field | Continuity |
|-------|------------|
| `peerTrust` | Contacts / muted |
| `chatState` (+ native SQLite evidence on Tauri) | Conversations / messages |
| `requestFlowEvidence` / outbox | Pending graph |
| `relayList` / `privacySettings` / `uiSettings` | Preferences |
| `communityMembershipLedger` / `roomKeys` | Groups |
| `messageDeleteTombstones` | Delete honesty |
| `nativeSqliteEvidence` | Tauri DM truth hints |
| Media **blobs** | **Out of band** — URLs + local media index; rehydrate via CAS / download |

### Why Network looked “deleted”

1. New surface / empty data root → no local peers.  
2. Native unlock **skips auto restore** (`shouldSkipAutoAccountSyncOnUnlock`) → Path R never runs.  
3. User never ran Path L.  
→ Empty Network is **missing restore**, not missing architecture.

## Delivery model (strangler — no greenfield)

| Phase | Goal | Owner | Proof |
|-------|------|-------|-------|
| **P0 — Continuity gate (friendship)** | On unlock, if identity ready **and** contacts+chat empty **and** relays open → **forced/guided restore** (Path R) or deep-link Path L; never silent blank Network | TS Settings + Network empty (started) + unlock gate | L2: new empty profile → restore prompt → peers return |
| **P1 — Publish reliability** | Ensure Device A publishes after contact/DM mutations (respect cooldown; no unlock stampede) | `useAccountSync` / Rust schedule later | L1 publish reasons · L2 peer appears on Device B after restore |
| **P2 — Native restore owner** | Finish [native-account-sync-phase-machine](./native-account-sync-phase-machine-design-2026-10.md) Step C: one Rust restore flight; Settings + P0 gate call it | Rust façade + TS UI | Unlock journal quiet · restore once |
| **P3 — SQLite body fidelity** | Cross-device DM bodies include SQLite-derived content in backup/apply (known gate in as-built synthesis) | backup evidence + apply | L3 cold restore bodies visible |
| **P4 — Media continuity** | Document + improve: attachment digest restore → re-fetch; optional portable media pack | vault / CAS | L2 sample image survives restore |

### Explicit non-goals (this charter)

- Real-time CRDT contact mesh / multi-device simultaneous edit.  
- Soft L3 dual-window shared memory.  
- Auto-copy between `.obscur-mobile-preview-data` and desktop AppData in lab (preview isolation stays; P0 explains it).  
- Matrix / Tor as sync fabric.

## UX contract (user-facing honesty)

1. **First unlock on empty device:** “Restore your Obscur data” primary (relay) · “Import backup file” secondary · “Start fresh” destructive tertiary.  
2. **Network empty after hydrate:** keep Find People + Restore CTAs (landed copy).  
3. **Settings → Identity / Storage:** single “Account continuity” card — Publish now · Restore now · Export file · Import file.  
4. Never claim “synced” unless restore/publish result is `applied` / `ok|partial`.

## Invariants

1. **One restore flight** at a time (align Rust Step C).  
2. **Unlock silence by default** — P0 may run **one** restore when empty-device heuristic hits; not continuous rehydrate timers.  
3. **Same pubkey** — restore rejects mismatched bundle/backup.  
4. **Subtraction first** — extend backup payload / gates; do not add parallel `ContactCloudService`.

## First implement slice (P0 — landed this session)

**P0 Continuity gate:**

1. Detect: unlocked + peer/messaging hydrated + `acceptedPeers.length === 0` + no local connections + not session-dismissed.  
2. `EmptyDeviceContinuityGate` sticky dialog: Restore from relays / Import backup file → Settings / Continue empty.  
3. Restore → existing `runManualAccountSyncRestore` (Settings + Network empty CTA + gate).  
4. L1: `empty-device-continuity-policy.test.ts`. L2: empty preview → restore → Network non-empty (if backup on relays).

If no backup on relays: toast reports `No encrypted backup found on relays` and Path L / Find People remain — no infinite spinner.

Artifacts:

- `apps/pwa/app/features/account-sync/services/empty-device-continuity-policy.ts`
- `apps/pwa/app/features/account-sync/components/empty-device-continuity-gate.tsx`
- Mount: `UnlockedAppRuntimeShell`

## Proof layers (program)

| Layer | Command / action |
|-------|------------------|
| L1 | Heuristic + restore intent unit tests |
| L2 | Manual: Device A publish → Device B empty unlock → P0 restore → contacts |
| L3 | Tauri cold start; SQLite bodies after P3 |
| L4 | Optional soak: mutation publish → second device restore lag |

## Claim language

| Allowed after P0 | Forbidden until P3/P4 |
|------------------|------------------------|
| “Restore recovers contacts + chat graph from backup” | “Realtime sync everywhere” |
| “Export/import works offline” | “All vault files always travel in backup” |
| “Empty new device prompts restore” | “Preview shares desktop AppData automatically” |

_Last updated: 2026-10-25T07:47:00Z_
