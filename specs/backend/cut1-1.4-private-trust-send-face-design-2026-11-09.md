# Design — Cut 1.4 Private-trust send face (K-SEND-FACE / K-PROTO-PLAIN)

**Date:** 2026-11-09  
**Status:** **L1 Pass** (desktop L2 send soak optional / owed with 1.6)  
**Parent:** [cut1-replacement-authority-design-2026-11-09.md](./cut1-replacement-authority-design-2026-11-09.md) §1.4

```text
HANDOFF ATOMIC STEP: Cut 1.4 K-SEND-FACE / K-PROTO-PLAIN
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     prepareT3Outbound → privateDcSendEnvelope → completeT3HomeAck
PROOF BEFORE DONE:   L1 — private_dc adapter refuses plaintext body; T3 path unit Pass
SURFACE:             private_dc / H-dc lab + Tauri engine host
```

## Goal

When active protocol is `private_dc` (private-trust / H-dc home), product send must not POST plaintext `body`. Wire = T3 sealed envelope + home ACK (`accepted` ≠ delivered). Nostr remains adapter-only via `sendDmNostrOnly`.

## Deliver

1. Policy: `privateDcRequiresT3Wire()` true for private_dc carrier.
2. `privateDcAdapter.sendMessage({ body })` throws `private_dc_t3_plaintext_refused`.
3. `sendPrivateTrustT3Message`: engine `prepareT3Outbound` → `privateDcSendEnvelope` → `completeT3HomeAck`.
4. `ProtocolAdaptationLayer.sendDm` routes `private_dc` to T3 path (not plaintext).
5. L1 vitest: refuse + mocked prepare/envelope/ack path.

## Non-goals

- Soft L3 Fixed · chat-state demotion (1.5) · making Nostr unavailable · Tor Verified
