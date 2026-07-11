# DM contact-request sandbox — design spec

**Status:** Draft (2026-07-11)  
**Band:** `ASE-1d` — **ACTIVE** (extends ASE-1a–c; pairs with Lane 5 contact/trust verification)  
**Pairing:** [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md) · [core-verification-contacts-trust-and-request-flows.md](../../docs/releases/core-verification-contacts-trust-and-request-flows.md)

---

## 1. Problem

After Tester2 sends a connection request to DemoUser today:

1. **Both peers appear in the DM (Chats) sidebar** — `handleCreateChat` / `onCreate` adds a `createdConnections` row immediately after `sendConnectionRequest`, and `resolveDmPeerEstablishedForUi` treats outgoing-pending + existing thread as “established.”
2. **The sender can send unrestricted plain DMs** — `use-chat-actions` calls `sendDm` (not sandboxed), then **auto-accepts** the peer on the sender side.
3. **Recipient sees messages in a full chat thread** instead of Requests-only until accept.
4. **v2 receive** does not classify `connection-request` tags into the requests inbox (`upsertIncoming` unused on live ingest).

ASE-1c (M3 send ceremony) only confirms sender identity on first plain DM — it does **not** implement recipient-gated contact requests or harassment limits.

---

## 2. Target product model

### 2.1 Lifecycle (high level)

```text
[none] ──send request──► [pending] ──Q&A sandbox──► [accepted] ──► DM sidebar (full chat)
                              │                           ▲
                              └── decline / cancel ──► [terminal]
```

| Phase | Chats sidebar | Requests tab | Compose capabilities |
|-------|---------------|--------------|----------------------|
| **Pending (outgoing)** | Hidden for both peers | Visible (outgoing pending for A, incoming for B) | **Sandbox Q&A only** — text, no attachments/voice |
| **Pending (incoming)** | Hidden | Visible with Accept / Decline | Recipient: sandbox reply + one-tap accept/reject |
| **Accepted** | Both peers visible | Row removed or archived | Full DM (existing path + M3 ceremony rules as today) |

### 2.2 Q&A sandbox (“question-and-answer mode”)

While `handshake.status === pending`:

- **Both parties** may exchange **short text messages** to verify trust (fingerprint questions, “who referred you?”, etc.).
- Messages are **not** full chat — they live in the **Requests thread view**, not the Chats list.
- **Neither party** may:
  - attach files, images, voice notes, or other media
  - open arbitrary external links from the thread (warn locally; no auto-open)
  - paste secrets (`nsec`, recovery phrases) — M1 firewall (offline)
- **Either party** may **Accept** (promotes to contact) or **Decline** (terminal).
- **Rate limits** from `incoming-request-anti-abuse` apply to inbound sandbox traffic.

Security modules (**M1 secret firewall**, future **M4 link safety**, attachment block) must run **fully offline** — no relay or coordination dependency.

### 2.3 Accept / decline UX (recipient B)

- Requests row opens a **sandbox thread** with ASE-1b **identity binding panel** pinned.
- Primary actions: **Accept** · **Decline** (single explicit buttons; decline does not require opening full settings).
- Accept requires relay evidence per `request-transport-service` (no optimistic trust).
- On accept: both sides get `peerTrust.acceptPeer` **only after** evidence; DM conversation row created; Chats sidebar updated.

Sender A sees the same sandbox thread under **Requests → Outgoing** with status “Waiting for acceptance” but can still send sandbox replies.

---

## 3. Wire protocol (v1)

Reuse NIP-17 DM transport with lifecycle tags (existing + one new):

| Tag `t` | Direction | Purpose |
|---------|-----------|---------|
| `connection-request` | A → B (first) | Intro + optional note; opens pending handshake |
| `connection-qna` | A ↔ B while pending | Sandbox text only |
| `connection-accept` | Either → other | Terminal accept + evidence |
| `connection-decline` | Either → other | Terminal decline |
| `connection-cancel` | Outgoing → cancel pending | Terminal cancel |

**Rules:**

1. First contact to an unaccepted peer **must** use `connection-request` (never untagged plain DM).
2. While pending, **only** `connection-qna` and lifecycle tags allowed — block untagged `sendDm` in `use-chat-actions`.
3. After `accepted`, untagged user DMs use the normal `sendDm` path.

---

## 4. Canonical owners (one path per action)

| Concern | Owner | Subtract / stop using |
|---------|-------|------------------------|
| Send gating (pending vs full) | `request-transport-service.ts` + new `contact-request-compose-gate.ts` | Plain `sendDm` from `use-chat-actions` for unaccepted peers |
| Receive classification | `dm-receive-pipeline` (v2) | Legacy `incoming-dm-event-handler` assumptions |
| Inbox state | `use-requests-inbox.ts` + handshake machine | Ad-hoc `setStatus` without receive feed |
| Sidebar visibility | `use-filtered-conversations.ts` + `dm-peer-established-ui.ts` | `establishedDmPeerPubkeys` shortcut for pending peers |
| Trust commit | `request-transport-service.acceptIncomingRequest` | Sender `peerTrust.acceptPeer` in `use-chat-actions` |
| Sandbox policy (offline) | `contact-request-sandbox-policy.ts` (new) | Per-component attachment/voice checks |
| Secret / script block | `secret-input-firewall.ts` (M1) | Duplicate heuristics in UI |
| Chat row creation | `global-dialog-manager.handleCreateChat` | `onCreate` after request send |

---

## 5. Required code changes (by slice)

### ASE-1d-a — Sidebar / list subtraction

- **Done (2026-07-11)** — pending peers hidden from Chats; no `onCreate` after request send; outgoing pending set in `sendRequest`

### ASE-1d-b — Receive → inbox

- **Done (2026-07-11)** — `contact-request-receive-classifier.ts`; receive pipeline returns `contact_sandbox` / `contact_lifecycle`; `dm-controller` calls `upsertIncoming` + `applyIncomingContactLifecycle`; stranger untagged DMs blocked

### ASE-1d-c — Send subtraction

- **Done (2026-07-11)** — `contact-request-sandbox-policy.ts`; sandbox Q&A via `connection-qna`; no sender auto-accept; blocked plain DM for strangers

### ASE-1d-d — Sandbox policy (offline security)

- **Done (2026-07-11)** — `assertDmOutboundAllowed` in `contact-request-sandbox-policy.ts` (M1 + sandbox limits + lifecycle tag rules); enforced in `dm-controller.sendDm` for every outbound path including `onSendDirectMessage`, voice-call signals, and retries

### ASE-1d-e — Requests UI

- **Done (2026-07-11)** — `ContactRequestThreadBanner` in sandbox threads: identity binding panel, Accept/Decline (with L2 confirm dialog), outgoing waiting + cancel; unified accept/decline handlers in `main-shell`

---

## 6. State machine extension

Extend `connection-handshake-machine` with implicit `QNA` sub-state while `pending` (no separate status — compose mode derives from `pending`).

| Event | From | To |
|-------|------|-----|
| `SEND_REQUEST` | none / declined / canceled | pending (outgoing) |
| `RECEIVE_REQUEST` | none / declined / canceled | pending (incoming) |
| `SANDBOX_MESSAGE` | pending | pending |
| `ACCEPT` | pending | accepted |
| `DECLINE` | pending | declined |
| `CANCEL` | pending (outgoing) | canceled |

---

## 7. Non-goals (this band)

- Group invite sandbox (separate charter).
- Server-side moderation or plaintext scanning on relay.
- FIDO2 / hardware step-up on accept (KEY-MOAT Phase 6 deferred band).
- Fixing projection/SQLite unread reassertion (separate `dm-unread-read-ack` band — but accept should not inflate DM unread until Chats row exists).

---

## 8. Proof plan

| Layer | Evidence |
|-------|----------|
| **L1** | `contact-request-sandbox-policy.test.ts` — attachment block offline; `dm-peer-established-ui` pending ⇒ not in Chats; receive tag classification fixtures |
| **L2** | Requests sandbox thread component — compose disabled for attachments; accept button present |
| **L3** | Dual-window: Tester2 → DemoUser request → **neither** in Chats sidebar → B accepts → both in Chats; sender cannot plain-DM before accept |
| **L4** | Maintainer demo GIF: discovery invite → Requests only → Q&A → accept → DM |

**Commands (target):**

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/contact-request-sandbox-policy.test.ts \
  app/features/messaging/services/dm-peer-established-ui.test.ts \
  app/features/messaging/services/request-transport-service.test.ts \
  app/features/messaging/hooks/use-requests-inbox.integration.test.ts
pnpm verify:path-b-b5   # anti-abuse + request transport
```

---

## 9. Phased delivery

| Slice | Exit |
|-------|------|
| **ASE-1d-a** | Pending peers absent from Chats sidebar; no `onCreate` after request |
| **ASE-1d-b** | Live receive feeds requests inbox from tags |
| **ASE-1d-c** | Send path: request + sandbox qna only; no sender auto-accept |
| **ASE-1d-d** | Offline sandbox policy enforced on compose |
| **ASE-1d-e** | Requests thread UI + accept/decline one-tap |

**Forbidden:** UI-only stranger banners while plain DM path remains open.

---

## 10. Open questions (maintainer)

1. Max sandbox messages per peer per hour (reuse burst limits or separate cap)?
2. After decline, allow new request from same peer immediately or cooldown?
3. Should accept from A (outgoing) be allowed if B sent the first request (cross-initiation)?

_Default assumptions for implementation:_ reuse existing anti-abuse cooldowns; decline ⇒ cooldown; either party can accept once pending exists.
