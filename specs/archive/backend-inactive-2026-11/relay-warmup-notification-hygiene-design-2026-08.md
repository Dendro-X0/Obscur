# Design — Relay network warm-up + notification hygiene

**Date (UTC):** 2026-08-05  
**Status:** Ready to implement  
**Prior:** [relay-warmup-notification-hygiene-investigation-2026-08.md](./relay-warmup-notification-hygiene-investigation-2026-08.md)

---

```text
HANDOFF ATOMIC STEP: Voice call OS notification (user pivot: warm-up + message toast hygiene)
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      warmRelayNetworkForSend · notification-presentation · desktop-notification-handler
PROOF BEFORE DONE:    L1 warm helper + presentation + handler tests
OUT OF SCOPE:         Soft L3 · AUTH-SESSION · groups/** · video · public Nostr SLA
```

## Contract

### 1. Relay network warm-up (send path)

New helper `warmRelayNetworkForSend` in `apps/pwa/app/features/messaging/controllers/v2/relay-network-warmup.ts`:

- If any pool connection is `open` → ready immediately.
- Else await `waitForScopedConnection(targets, 8s)` when targets exist; else `waitForConnection(8s)`.
- Return `{ ready, openRelayCount }`.

`sendDm` (after `resolveTargetRelayUrls`, before `publishToRelays`):

- Call warm helper.
- If not ready and still zero open → `buildSendConfirmation` with `no_writable` / overallError `"no writable relays"`, invoke `onConfirmed` if set, return Phase-1 result with `deliveryStatus: "queued_retrying"` and `reasonCode: "no_writable_relays"` (honest queue, not ACK timeout red herring).

`sendDmWithRetry`: before `shouldQueueBeforeSend`, run the same warm helper once so early zero-writable can become ready.

### 2. Message notification presentation

`buildMessageNotificationPresentation`:

| Field | Value |
|-------|--------|
| `title` | `New message from {name}` or `{name} in {group}` — **no emoji** |
| `body` | `{emoji} {context} • {time}\n{preview}` — **single** emoji on description |

Coalesced flush: multi-count title = `buildCoalescedMessageNotificationTitle` **without** re-prefixing emoji.

Call presentation unchanged (already name + preview, no emoji).

### 3. Suppress when viewing that chat

- `isDocumentVisible()` = `visibilityState === "visible"` (no `hasFocus` requirement for suppress).
- Suppress all message notifications when visible **and** `isViewingTargetConversation`.
- `isBackgroundAlert` / OS path = `!isDocumentVisible()` (other app / minimized). Visible + other conversation → in-app toast only.

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/messaging/controllers/v2/relay-network-warmup.test.ts app/features/notifications/utils/notification-presentation.test.ts app/components/desktop-notification-handler.test.tsx app/features/messaging/controllers/v2/dm-send-pipeline.test.ts` |
| L3 | Maintainer: cold-start send waits/connects without spurious confirm-fail; OS toast single icon; viewing open DM does not OS-toast |

## Subtraction

- Do not add a second send owner; warm inside canonical `sendDm`.
- Do not require `hasFocus` for same-chat suppress (subtract false-background).
