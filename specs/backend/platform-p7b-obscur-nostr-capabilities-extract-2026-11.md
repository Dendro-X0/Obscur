# Design — P7b Obscur-Nostr capabilities extract (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-p7-obscur-nostr-body-extract-2026-11.md](./platform-p7-obscur-nostr-body-extract-2026-11.md)

```text
HANDOFF ATOMIC STEP: P7b Obscur-Nostr capabilities leaf — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote · mass folder rename
CANONICAL OWNER:     @obscur/protocol-nostr
PROOF:               Package exports OBSCUR_NOSTR_CAPABILITIES · adapter uses it · contract Pass
```

## 1. Goal

Second pure body leaf after P7 maps: advertise Obscur-Nostr **capabilities** from the package so forks/settings can read them without importing the pwa adapter.

## 2. Cut

1. `packages/obscur-protocol-nostr/src/capabilities.ts` — `OBSCUR_NOSTR_CAPABILITIES` + `formatNostrCanonicalSendRequiresCredentialsError`.
2. Export from package index + `./capabilities`.
3. `nostr-adapter` uses both; no local capability object literal.
4. Contract: adapter imports package; package has no `@/app` imports.

## 3. Non-claims

- Not full send/list orchestration extract
- Not Soft L3 / Tor / Matrix promote
