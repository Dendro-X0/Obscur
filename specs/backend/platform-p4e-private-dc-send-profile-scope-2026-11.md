# Design — P4e private_dc send profile scope (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-p4b-private-dc-http-wire-design-2026-11.md](./platform-p4b-private-dc-http-wire-design-2026-11.md)  
**Related:** hard-profiles law · [sandboxed-storage-security-design-2026-11.md](./sandboxed-storage-security-design-2026-11.md)

```text
HANDOFF ATOMIC STEP: P4e private_dc sendMessage profile scope — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · private-dc-adapter · ProtocolAdapter.sendMessage
PROOF:               L1 vitest — send uses profile session; wrong profile fail-closed
```

## 1. Gap

`listConversations` / `listMessages` call `requireSession(profileId)`.  
`sendMessage` called `requireSession()` with **no** profile id → resolved active profile session only. A caller listing as profile A could send with profile B’s default session. Matrix had the same send gap.

## 2. Cut

1. `ProtocolAdapter.sendMessage` params include required `profileId` (platform scope, not wire).
2. `privateDcAdapter` + `matrixAdapter` `requireSession(params.profileId)`.
3. Layer `sendMessage` / `sendDm` Matrix·private_dc shim pass `profileId`.
4. Soak hooks accept `profileId` on send.
5. Contract: S3 canonical send params allow `profileId` (still forbid Nostr wire fields).

## 3. Proof

| Layer | Check |
|-------|--------|
| L1 | `private-dc-adapter` send + wrong-profile fail · S3 canonical `profileId` on send · d0 characterization Pass |

## 4. Non-claims

- Not Soft L3 / Tor Verified / Matrix promote
- Not production company-DC operator soak
- Not mass path rename / Obscur-Nostr package extract
