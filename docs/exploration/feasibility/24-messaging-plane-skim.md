# Feasibility — Messaging plane skim (1:1 · outbox · receipts · schema freeze)

**ID:** F-msg  
**Status:** draft (skim — unlocks Cut 0 message-table freeze per F-confirm A1)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-confirm A1/A2/A4/A7 · F9 · F5 · F4 · F1 · F8 · F-PSE · F-sync  
**As-built lean:** native DM via **dm-kernel** + SQLite durability · delivery status machine (`sending|queued|accepted|rejected|delivered|failed`) · web inert stub · groups still separate hydrate path  
**Claim language:** **skim** ≠ messaging Pass · ≠ T3 shipped · ≠ Soft L3 Fixed · ≠ Cut 0 designed

## 1. Scope

- **In:** Enough messaging-plane shape to freeze Cut 0 **conversation/message** tables and ports under NARROW (private-trust · thin H-dc · **T3** launch).
- **Out:** Full UX polish; calls/voice signaling product; group MLS (T4); Matrix rooms; edit/delete every edge case; Soft L3 contact Pass.

## 2. Basics

Messaging is a **platform plane**, not a Nostr feature:

```text
UI (thin)
  → Message ports (send / hydrate / ack status)
      → Kernel: conversation + message rows (SQLite, at-rest per A5)
      → Crypto: Obscur DR session (T3) for private-trust 1:1
      → Transport adapter: thin H-dc (A2) encodes/delivers ciphertext
```

| Concept | Is | Is not |
|---------|----|--------|
| **Conversation** | Local durable thread object (dm \| group stub) | Relay query result |
| **Message** | Canonical row + delivery status | Raw Nostr event as sole PK |
| **Outbox** | Local queue until home accepts | “Fire and forget to public relays” |
| **Receipt / delivered** | Optional peer/device ack — honest if absent | Fake double-check from relay OK |
| **Home pin** | Thin H-dc for private-trust lab (A7) | Public carrier required for first lovable |

### As-built → rewrite pressure

| Today | Pressure for Cut 0 |
|-------|-------------------|
| `dm-kernel` owns native DM read | Keep **one** thread owner; move toward Rust kernel |
| `MessagePersistenceService` SQLite flush | Schema becomes kernel-owned; UI stops dual-writing |
| Status machine already portable (pure TS) | Promote to shared contract / Rust |
| NIP-17/gift-wrap fields on `Message` | Adapter metadata only — not CRM/message PK |
| Web inert empty threads | Accept until native/kernel path is the product |

## 3. Capabilities map

| Need | Cut 0 / launch posture | Notes |
|------|------------------------|-------|
| Send 1:1 private-trust | yes | Ciphertext via T3 DR; deliver on thin H-dc |
| Receive / hydrate | yes | Pull/push from home → decrypt → upsert rows |
| Outbox retry | yes | `queued` / `rejected` → retry; durable across relaunch |
| Relay/home accepted | yes | Map to `accepted` (home ACK ≠ peer read) |
| Peer delivered | partial | Optional; UI must not imply if protocol lacks ack |
| Read receipts / typing | defer | Metadata leakage; not Cut 0 |
| Edit / delete | stub columns OK | Tombstone `deleted_at`; full UX later |
| Attachments | vault CAS + message refs | File DEKs separate (F5 open Q) |
| Groups | conversation kind stub | T4 MLS later (C5); no fake T3 group badge |
| Public Nostr DM | adapter later | Not required for A7 lab milestone |
| Continuity | message bodies in sealed backup | Couples to A5 + F-sync |

### Delivery status (keep)

Canonical enum (as-built, portable):

`sending` → `accepted` | `rejected` | `failed`  
`rejected` → `queued` → `sending`  
`accepted` → `delivered` (only on real peer/device confirm)

**Honesty rule:** home ACK = `accepted` (“sent to home”), never auto-`delivered`.

## 4. Fit to planes

| Plane | Messaging rule |
|-------|----------------|
| Auth | Unlock before send; no send while PDK closed |
| Profile | All rows scoped by `profileId`; hard isolation |
| Storage / DB | `conversation` + `message` + `outbox` (+ optional `receipt`) in encrypted SQLite (A5) |
| Relationship | Send allowed by sticky graph policy — **not** invented from message history (F1); Soft L3 paused |
| Message | This note’s owner plane |
| Transport | Thin H-dc adapter; pin stored on conversation/home |

## 5. Libraries / stacks

| Piece | Lean |
|-------|------|
| Durability | SQLite (kernel) + at-rest (B6 pick) |
| Crypto 1:1 | Obscur Double Ratchet (F5 E2) — **required for launch face (A4)** |
| Transport | Thin H-dc API (membership + message blobs + optional CAS) |
| UI | React read-models via TanStack Query; no second message store |
| Reject | chat-state as durability owner; NIP-17 labeled T3; relay lookback as inbox rebuild |

### Suggested Cut 0 schema spine (post-skim freeze candidate)

```text
conversation(
  id, profile_id, kind[dm|group],
  peer_or_group_key, home_id,
  crypto_tier, created_at, ...
)
message(
  id, conversation_id, profile_id,
  sender, recipient?,
  body_ciphertext_or_local_plain_after_unlock,
  status, event_or_home_id?,
  created_at, deleted_at?, ...
)
outbox(
  message_id, next_attempt_at, attempt_count, last_error, ...
)
# receipts optional table — defer rows until ack protocol exists
```

Wire event ids (Nostr/`relayPublishedEventId`) = **adapter indexes**, not sole primary keys.

## 6. Feasibility verdict

**`fit-with-adapter`** — Messaging under NARROW is feasible as: **local canonical threads + outbox + honest status + T3 DR + thin H-dc delivery**, with public carriers additive later.

**`reject-for-core`:** History-as-inbox; relay OK as “delivered”; NIP-17 as T3; dual TS/Rust message owners; requiring Matrix/Nostr for A7 lab.

### Cut alignment (given F-confirm A)

| Band | Messaging deliverable |
|------|----------------------|
| **Cut 0 design** | Freeze tables above · ports · status machine · H-dc message blob shape · T3 session hooks |
| **Cut 0 lab (A7)** | Vault+CRM+encrypted DB + **send/receive 1:1 on thin H-dc with T3** (or clearly gated “crypto incomplete” — but A4 says launch face needs T3, so lab path must include E2 plan) |
| **Later** | Groups T4 · receipts UX · public Nostr DM module · calls |

## 7. Risks / traps

- A4 + A2 + A5 stack → Cut 0 larger than account spine alone; sequence **spine → encrypt DB → H-dc ping → T3 1:1**.  
- Reusing NIP-17 path and calling it T3.  
- `delivered` from home ACK.  
- Group tables pretending MLS ready.  
- Soft L3 “fixed” because DMs send.

## 8. Open questions (for Cut 0 design — not blockers to freeze *shape*)

1. Body storage: plaintext-at-rest inside encrypted DB file vs per-row AEAD after unlock?  
2. Thin H-dc: push websocket vs poll for receive MVP?  
3. Multi-device T3: Sesame-like enroll required before A4 launch, or single-device T3 first?  
4. Attachment DEKs: session-derived vs independent (F5 Q4)?  
5. B3: messages in same SQLite file as graph or split file?

## 9. References

- `23-cut0-confirmation-gate.md` (A1–A8)  
- `05-e2ee-models.md` · `04-private-relay-server.md` · `01-relationship-authority.md`  
- `08-universal-auth-profile-db.md` · `20-cross-device-profile-sync-e2ee.md`  
- As-built: `use-thread-messages.ts` · `message-delivery-machine.ts` · `message-persistence-durability-owner.tsx` · `dm-kernel`  
