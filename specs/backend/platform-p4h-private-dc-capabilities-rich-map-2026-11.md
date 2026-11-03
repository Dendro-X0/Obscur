# Design — P4h private_dc capabilities + rich map leaf (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-p4g-private-dc-rich-list-shim-2026-11.md](./platform-p4g-private-dc-rich-list-shim-2026-11.md)

```text
HANDOFF ATOMIC STEP: P4h private_dc capabilities + rich map — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · private-dc-adapter / private-dc-rich-map
PROOF:               PRIVATE_DC_CAPABILITIES · rich map unit + adapter uses leaf · contract Pass
```

## 1. Goal

Mirror P7b for Private DC: named **capabilities** constant and extracted **canonical → rich** mappers so the adapter stays a thin wire owner.

## 2. Cut

1. `private-dc-capabilities.ts` — `PRIVATE_DC_CAPABILITIES`
2. `private-dc-rich-map.ts` — `mapPrivateDcConversationToRich` · `mapPrivateDcMessageToRich`
3. Adapter imports both; no inline capability object / local map helpers
4. Unit + contract Pass

## 3. Non-claims

- Not production company-DC soak
- Not Soft L3 / Tor / Matrix promote
- Not Obscur-Nostr package extract
