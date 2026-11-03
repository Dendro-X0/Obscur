# Design — P4g private_dc rich DM list shim (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-p4f-private-dc-connect-list-scope-2026-11.md](./platform-p4f-private-dc-connect-list-scope-2026-11.md)

```text
HANDOFF ATOMIC STEP: P4g private_dc rich list shim — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · private-dc-adapter · getRichListAdapter
PROOF:               L1 vitest — private_dc active → listDm* from DC, not Nostr
```

## 1. Gap

`getRichListAdapter` routes Matrix to `matrixAdapter` but leaves `private_dc` on **Nostr**. Selecting Private DC in Settings still loads Obscur-Nostr sidebar/thread via rich ports — dual-surface lie.

## 2. Cut

1. `privateDcAdapter.listDmConversations` / `listDmMessages` — map canonical `/v1` rows → rich `DmConversation` / `Message` (conversation id in `pubkey` slot, same pattern as Matrix room id).
2. `getRichListAdapter("private_dc")` → `privateDcAdapter`.
3. Contract: layer must not fall through private_dc to nostr for rich list.

## 3. Proof

| Layer | Check |
|-------|--------|
| L1 | adapter rich map + `platform-p4g-private-dc-rich-list.contract` Pass |

## 4. Non-claims

- Not Soft L3 / Tor / Matrix promote
- Not rich media / groups on private_dc
- Not production company-DC operator soak
