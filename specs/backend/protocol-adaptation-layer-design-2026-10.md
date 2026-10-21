# Design — Protocol adaptation layer (unified UI, modular backends)

**Date (UTC):** 2026-10-17  
**Status:** Accepted · Phase 0–3 implemented (C0–C3)  
**Parent:** [protocol-adaptation-layer-investigation-2026-10.md](./protocol-adaptation-layer-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: Protocol adaptation layer — Phase 0 contract + Nostr adapter extraction
PAUSED / CANCELLED: Soft L3 · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: ProtocolAdaptationLayer (registry) · adapters register; UI → façade only
PROOF (Phase 0): contract tests — UI imports never call nostr relay APIs directly for send/list
```

## Product invariant

> Obscur’s **frontend experience is protocol-stable**.  
> Protocols and networks are **modules** the user selects in Settings.  
> Switching must feel continuous (same shell, same conversation metaphors), with honest capability gaps (e.g. Matrix rooms ≠ Nostr DMs) surfaced as UI affordances — not silent dual-writes.

## Architecture (three planes)

```text
┌─────────────────────────────────────────────┐
│  Unified UI (composer, thread, settings)    │  ← never imports adapter internals
└──────────────────┬──────────────────────────┘
                   │ ProtocolSessionPort (façade)
┌──────────────────▼──────────────────────────┐
│  ProtocolAdaptationLayer (registry + router) │  ← sole switch owner
├─────────────┬─────────────┬─────────────────┤
│ NostrAdapter│ MatrixAdapter│ …              │  ← modular, hot-selectable
└──────┬──────┴──────┬──────┴─────────────────┘
       │             │
┌──────▼──────┐ ┌────▼────────────────────────┐
│ Transport   │ │ Identity / Vault (shared)   │
│ Clearnet /  │ │ profiles, LES, backup       │
│ Tor / Quiet │ └─────────────────────────────┘
└─────────────┘
```

### Protocol plane (user-selectable)

| Id | Module | Phase |
|----|--------|-------|
| `nostr` | Existing relay/NIP path wrapped as adapter | **0** (extract) |
| `matrix` | Homeserver client + E2EE adapter | **2** |
| future | XMPP / custom | later |

### Transport / network plane (user-selectable, orthogonal)

| Id | Behavior | Phase |
|----|----------|-------|
| `clearnet` | Direct WS/HTTPS | **0** |
| `tor` | SOCKS via existing Tor gateway | **1** (settings productize; not Tor Verified band) |
| `quiet` | Existing Quiet path | keep; respect dial caps / PAUSED uncapped |

Protocol switch ≠ transport switch. UI can show both: e.g. Protocol=Nostr, Network=Tor.

## Façade contract (TypeScript → later Rust thin host)

```typescript
type ProtocolId = "nostr" | "matrix"; // extend
type TransportId = "clearnet" | "tor" | "quiet";

type CanonicalMessage = Readonly<{
  id: string;                 // opaque to UI — adapter-minted
  conversationId: string;
  body: string;
  sentAtUnixMs: number;
  direction: "in" | "out";
  status: "sending" | "sent" | "failed" | "delivered";
  // protocol metadata lives in adapter store / opaque blob — not UI fields
}>;

interface ProtocolAdapter {
  readonly id: ProtocolId;
  capabilities(): Readonly<{ dms: boolean; groups: boolean; reactions: boolean; media: boolean }>;
  connect(transport: TransportId): Promise<void>;
  disconnect(): Promise<void>;
  listConversations(): Promise<ReadonlyArray<{ id: string; title: string }>>;
  listMessages(conversationId: string, limit: number): Promise<ReadonlyArray<CanonicalMessage>>;
  sendMessage(params: Readonly<{ conversationId: string; body: string }>): Promise<CanonicalMessage>;
}
```

**Rules**

1. UI/settings call **only** `ProtocolAdaptationLayer` (active adapter + active transport).
2. Nostr-specific types (`eventId`, nip17) stay **inside** `NostrAdapter`.
3. Persistence: Phase 0 may keep Nostr SQLite as NostrAdapter private store; Phase 2 adds Matrix store — **no dual-write** across adapters for one send.
4. Settings: `activeProtocolId`, `activeTransportId`, per-adapter config (relay list / Matrix HS URL) — persisted per profile.

## Phased delivery (modular, reassembled)

| Phase | Deliverable | Proof |
|-------|-------------|-------|
| **0** | Extract `NostrAdapter` behind façade; UI send/list through façade; Settings shows Protocol=Nostr (read-only switch UI shell) | Contract test: messaging UI modules must not import relay client for send |
| **1** | Transport selector Clearnet \| Tor wired to existing gateway; NostrAdapter honors transport | L2 desktop: Tor on → dials via SOCKS |
| **2** | `MatrixAdapter` MVP (login HS, sync rooms, send text); Settings switch Nostr ↔ Matrix | L2: switch protocol, same shell, different conversation list |
| **3** | Polish: capability chips, migration hints, performance budgets | L3 dual-profile |

## Subtraction / anti-patterns

- **Forbidden:** “Matrix bridge” that publishes every Nostr DM to Matrix (dual authority).
- **Forbidden:** UI branching `if (isMatrix)` for composer core — use `capabilities()`.
- **Forbidden:** Reopening Soft L3 / uncapped Quiet / Tor Verified under this track without explicit maintainer unpause.

## Relation to Track B

Track B (Rust authority, native crypto) **feeds** adapters — NostrAdapter keeps using `engine_invoke` / wallet AES. Adaptation layer does **not** replace Rust spine; it **routes** which spine the UI talks to.

## Next mutate (atomic)

Track C Phase 0–3 landed. Next: **L2** Matrix/Tor desktop soak **or** **B10** SubtleCrypto inventory — maintainer pick. **Do not reopen PAUSED bands.**

_Last updated: 2026-10-17T10:25:00Z_
