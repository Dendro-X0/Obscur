# Investigation — Client-side protocol adaptation layer

**Date (UTC):** 2026-10-17  
**Status:** Complete · design next  
**Maintainer intent:** Obscur is **not** “a Nostr client with a nice UI.” It is a **modular communication platform** — protocols/networks plug into a client-side adaptation layer; the unified UI stays stable while the user switches protocol/transport in Settings.

```text
HANDOFF ATOMIC STEP: Maintainer north star — protocol adaptation layer (supersedes B10 crypto inventory as next product track)
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · Tor Verified (unchanged)
CANONICAL OWNER (target): ProtocolAdaptationLayer (new) · UI consumes façade only
PROOF (this doc): inventory — no mutate
```

## Verdict

Today Obscur is effectively a **Nostr-first product**:

| Surface | Reality |
|---------|---------|
| Message model | `eventId`, `senderPubkey`, NIP-04/17 fields baked into `Message` |
| Persist | `engine_invoke` dm/workspace — Nostr event ids as row keys |
| Send/receive | Relay WS / Quiet / mesh — Nostr wire |
| Tor | Transport under Nostr (gateway/SOCKS), not a selectable “network product” |
| Matrix | **Absent** as a protocol backend |

There is **no** protocol-agnostic adaptation layer. Kernel ports (`dm-kernel-write-port`, `workspace-kernel-write-port`) are Nostr sealed-event owners, not interchangeable adapters.

Prior agent work (Track B Rust authority) correctly hardened the **Nostr/native** spine; it did **not** deliver the modular multi-protocol façade. That gap matches the maintainer complaint.

## What “done” means for the vision

1. **Settings** — user selects **protocol** (Nostr | Matrix | …) and **network/transport** (Clearnet | Tor | …).
2. **One UI** — conversations, composer, thread, presence feel the same; only status/capability chips change.
3. **Adapters** — each protocol is a loadable module implementing a shared port (send / receive / list / sync / capabilities).
4. **Reassemble** — enable/disable adapters without rewriting UI or SQLite product schema (canonical message DTO is protocol-neutral; adapters map wire ↔ DTO).

## Non-goals (this investigation)

Implement Matrix · reopen Tor Verified · Soft L3 · delete Nostr

_Last updated: 2026-10-17T08:25:00Z_
