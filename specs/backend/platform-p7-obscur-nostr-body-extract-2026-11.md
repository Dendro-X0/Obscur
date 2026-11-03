# Design — P7 Obscur-Nostr first body extract (2026-11)

**Status:** Landed (L1) — first body leaf only  
**Parent:** [platform-p5-naming-design-2026-11.md](./platform-p5-naming-design-2026-11.md) · S5 `@obscur/protocol-nostr`  
**Related:** [platform-rewrite-band-milestone-closeout-2026-11.md](./platform-rewrite-band-milestone-closeout-2026-11.md)

```text
HANDOFF ATOMIC STEP: P7 Obscur-Nostr first body extract — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote · mass folder rename
CANONICAL OWNER:     @obscur/protocol-nostr · protocol-adaptation/nostr adapter
PROOF:               Package exports rich→canonical mappers · adapter imports package · contract Pass
```

## 1. Goal

Start the deferred **package body extract** without a filesystem mega-rename: move the first **pure** Obscur-Nostr leaf (rich → canonical DTO maps) into `@obscur/protocol-nostr`. Live adapter remains under `IMPLEMENTATION_HOME` but no longer owns those helpers.

## 2. Cut (this slice)

1. `packages/obscur-protocol-nostr/src/canonical-from-rich.ts` — `mapRichMessageToCanonical` · `mapRichConversationToCanonical` with package-local input likes (no pwa imports).
2. Export from package `index` + `./canonical-from-rich`.
3. `nostr/nostr-adapter.ts` imports mappers from `@obscur/protocol-nostr`.
4. Contract: adapter source must import `@obscur/protocol-nostr` for maps; package must not import from `apps/pwa`.
5. Update S5 narrative: body extract **started** (not complete).

## 3. Explicitly deferred

- Moving `sendDm` / dm-kernel / relay pool into the package
- Renaming `features/messaging` or `@obscur/protocol-nostr` npm name
- Mass path renames

## 4. Non-claims

- Not “Obscur-Nostr fully extracted”
- Not Soft L3 / Tor / Matrix promote
- Not multi-protocol SDK complete
