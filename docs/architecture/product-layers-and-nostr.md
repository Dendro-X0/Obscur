# Product layers & Nostr adapter role

**Status:** Canonical architecture framing (2026-05-16)  
**Supersedes:** Implicit “Nostr is the product” assumptions in older drafts  
**Related:** [future/00-charter-vision.md](../future/00-charter-vision.md), [gateway/client-unified-gateway.md](../gateway/client-unified-gateway.md)

---

## Three layers

```text
┌────────────────────────────────────────────────────────────┐
│ APPLICATION — Obscur (apps/pwa, apps/desktop)               │
│  UI · delivery · settings · team/community configuration      │
└────────────────────────────┬───────────────────────────────┘
                             │ ClientGateway / profile runtime
┌────────────────────────────▼───────────────────────────────┐
│ KERNEL (in progress) — semantics + local truth                │
│  visibility · tombstones · projection · membership contracts    │
│  packages: crypto, core, storage-contracts, client-gateway    │
└────────────────────────────┬───────────────────────────────┘
                             │ transport adapters
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         @dweb/nostr    team server     (future)
         (optional       (concept)
          long-term)
```

---

## Application layer responsibilities

- Ship installers and web builds.
- Present honest product copy (hide, recall, limitations).
- Own React lifecycle, `main-shell`, feature modules under `apps/pwa/app/features/**`.
- Call **only** `getResolvedClientGateway()` / `messagingClientOperations` for behavioral mutations — not `@dweb/nostr` directly (target rule for new code).

---

## Kernel responsibilities (current monorepo: partial)

- Define what “hidden”, “recalled”, and “removed from timeline” mean.
- Profile-scoped persistence and event projection.
- Single materialization path for DM threads (hydrate pipeline, suppression prepare).
- Evidence-based account-sync mutations (no restore-over-tombstone races).

The **future kernel** in `docs/future/` describes the target; **v1.5.x implements** kernel pieces inside this repo without a separate repository yet.

---

## Nostr adapter — candid limitations

Maintain these in release notes and help text when Nostr transport is used:

| Topic | Limitation |
|-------|------------|
| Storage | Relays store events; recall does not erase historical copies |
| Other clients | Non-Obscur clients may ignore delete commands |
| Delivery | Recall requires recipient online / subscribed; not guaranteed |
| Identity | NIP-04 vs NIP-17 paths may differ; adapter must normalize to kernel events |
| Sync | Encrypted account backup can lag; local tombstones are authoritative for hide |

Nostr remains valuable for **open relay routing** and **censorship resistance** when users opt in.

---

## “Decent Nostr client” acceptance bar

For v1.5.x releases, we accept:

- Imperfect cooperative recall (Obscur ↔ Obscur, best-effort relay publish).
- Durable **hide on this device** as the primary trust feature.
- Known DM-001 class issues documented, not hidden.

We reject as **ship blockers**:

- Claims of global delete or guaranteed unsend.
- Marketing “sovereignty” without scoping what servers and relays can still see (metadata, timing, ciphertext shape).

---

## Code direction (enforcement gradual)

1. New feature code: gateway + profile scope.
2. Nostr imports: `packages/dweb-nostr`, `controllers/v2`, relay features, adapters only.
3. Profile-scoped buses and mutation signals (no global cross-profile UI leaks).

See [program/strategic-direction.md](../program/strategic-direction.md) for release sequencing.
