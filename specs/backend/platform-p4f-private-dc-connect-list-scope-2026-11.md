# Design — P4f private_dc connect + listMessages profile scope (2026-11)

**Status:** Landed (L1) · CDP matrix extended on P4d soak  
**Parent:** [platform-p4e-private-dc-send-profile-scope-2026-11.md](./platform-p4e-private-dc-send-profile-scope-2026-11.md)

```text
HANDOFF ATOMIC STEP: P4f connect/listMessages profile scope — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · ProtocolAdapter.connect · private-dc / matrix adapters
PROOF:               L1/L2 vitest · P4d CDP matrix connectOk + listMessages
```

## 1. Gap

P4e scoped `sendMessage`. Remaining:

1. `privateDcAdapter.connect` / `matrixAdapter.connect` still call `hasPrivateDcSession()` / `requireSession()` **without** profileId while the layer knows the active profile.
2. CDP soak hooks expose list/send but not `listMessages` — incomplete canonical port coverage.

## 2. Cut

1. `ProtocolAdapter.connect(transport, profileId?)` — session adapters require session for that profile.
2. Layer `connect` / `applyTransport` forward `profileId`.
3. Soak hooks: `listMessages({ profileId, conversationId, myPublicKeyHex, limit? })`.
4. Extend P4d CDP matrix with `listMessages` (lab seed thread).

## 3. Non-claims

- Not Soft L3 / Tor Verified / Matrix promote / production DC operator soak
