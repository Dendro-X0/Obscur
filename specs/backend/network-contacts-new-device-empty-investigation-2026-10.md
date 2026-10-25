# Investigation — Network contacts empty on “new device” (2026-10)

```text
HANDOFF ATOMIC STEP: adjacent P0 — empty Network after surface/device switch
PAUSED / CANCELLED: Soft L3 dual-window · Matrix · Tor Verified · video usable
CANONICAL OWNER: peer-trust + account projection · obscur data root
PROOF BEFORE DONE: name data root + acceptedPeers source (legacy vs projection)
SURFACE: mobile-preview and/or desktop AppData
```

## Symptom

User: contact list gone; “loses Network content when switching to a new device.”
Screenshot: Network → All People → **No connections found** · CONNECTIONS 0 · stamp `shell-2026-10-24T17:20:00Z` · ONLINE.

## Product truth (not a random UI wipe)

Contacts are **local-first** (accepted peers in profile-scoped storage + account projection). They do **not** magically appear on a blank data root. A “new device” / new preview partition with no restore / no re-sync correctly shows an empty Network until:

1. Account/workspace restore imports contacts, or
2. Projection/relay sync rebuilds accepted peers, or
3. User re-accepts peers.

## Confirmed cause on this machine

1. **`dev:mobile-preview` data root** — `.obscur-mobile-preview-data` is empty (no SQLite/contact store). Isolated from desktop AppData.
2. **Native unlock skips auto account-sync** — `shouldSkipAutoAccountSyncOnUnlock()` is true when `hasNativeRuntime()` (phone/desktop Tauri). Encrypted backup restore does **not** run on unlock; empty local Network stays empty until **manual** restore or re-add.
3. **Projection + legacy both empty** — UI correctly shows 0 connections.
4. **Not** caused by loading-skeleton / header chrome work.

## Likely cause on a true new phone (same product model)

Same: blank local store + no auto restore on native unlock → empty Network until Restore / Find People.

## What is NOT claimed broken without proof

- Cross-device automatic contact push as a shipped guarantee (check portability / account sync docs before calling it a regression).
- Soft L3 dual windows sharing one contact graph.

## Recovery (operator)

1. Confirm surface: preview data root vs desktop AppData.
2. Same profile label/pubkey as before?
3. Settings → Identity / Storage → restore backup or portable import if available.
4. Or Network → Add / Find People → re-accept peer (call smoke path).
5. Optional: read `obscur.peer_trust.v1.<pubkey>` / projection contacts count in that data root.

## Fix bands (only after evidence)

| Band | Action |
|------|--------|
| A — Preview isolation | Doc + UX honesty: empty Network on fresh preview is expected; link Restore / Manage profiles |
| B — Sync gap | If account sync should rebuild contacts and does not → separate projection investigation |
| C — Accidental wipe | Only if same data root + same pubkey lost peers without user clear |

Default this session: **Band A honesty + recovery**, not inventing a new sync stack.

## Follow-on (continuity program)

Cross-device design + P0 empty-device restore gate:
[cross-device-data-continuity-design-2026-10.md](./cross-device-data-continuity-design-2026-10.md)
(`EmptyDeviceContinuityGate` · Network Restore from relays → `runManualAccountSyncRestore`).
