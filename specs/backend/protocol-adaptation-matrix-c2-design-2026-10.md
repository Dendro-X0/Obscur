# Design — C2 MatrixAdapter MVP

**Date (UTC):** 2026-10-17  
**Status:** Accepted · implemented (L1)  
**Parent:** [protocol-adaptation-layer-design-2026-10.md](./protocol-adaptation-layer-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: C2 — MatrixAdapter MVP (login HS, sync rooms, send text; Settings switch)
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: MatrixAdapter · ProtocolAdaptationLayer registry
PROOF: L1 — thin CS client + adapter contracts; no dual-write to Nostr
```

## Goal

Selectable **Matrix** protocol behind the same façade as Nostr:

1. Homeserver URL + password login (access token session persisted per profile).
2. Room list → `listConversations` / sidebar mapping (no Nostr SQLite dual-write).
3. Room timeline text → `listMessages` / `sendMessage`.
4. Settings: Protocol = Nostr | Matrix (Matrix enabled when session config present or login succeeds).

## Non-goals (C2)

- Full E2EE / Olm-Megolm (cleartext rooms / server-side crypto only for MVP text).
- matrix-js-sdk dependency (thin Client-Server `fetch` client).
- Bridging Nostr DMs ↔ Matrix rooms.
- Reopening PAUSED bands.

## Architecture

```text
UI / MessagingProvider / dm-controller
        │
        ▼
ProtocolAdaptationLayer (activeProtocolId)
   ├── nostr  → existing dm-kernel / dm-send-pipeline
   └── matrix → MatrixAdapter → matrix-cs-client (HS REST)
```

### Session prefs (per profile)

| Key | Value |
|-----|--------|
| `homeserverUrl` | e.g. `https://matrix.org` |
| `userId` | `@user:server` |
| `accessToken` | opaque |
| `deviceId` | optional |

### Sidebar mapping

Matrix rooms projected to existing `DmConversation` shape for shell continuity:

- `id` = room id (`!…:server`)
- `displayName` = room name / canonical alias / room id
- `pubkey` = deterministic 64-hex fingerprint of room id (type compatibility only — not a Nostr key)

### Send routing

- Protocol **nostr**: `sendDm` → pipeline (unchanged).
- Protocol **matrix**: `sendDm` façade maps `plaintext` + selected conversation id → `MatrixAdapter.sendMessage` (ignore Nostr pool/keys).

## Proof

| Layer | Check |
|-------|--------|
| L1 | Unit: login/sync/send client (mocked fetch); contract: registry includes matrix; Settings selectable; no dual-write imports |
| L2 | Manual: login HS, see rooms, send text (ask) |

_Last updated: 2026-10-17T10:00:00Z_
