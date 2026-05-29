# Managed-workspace relay deletion (v1.8.9 — D1 / D3)

**Audience:** Product, support, maintainers  
**Related:** [v1.8.9-scope](../program/v1.8.9-scope.md), [deletion-roster-limitations.md](./deletion-roster-limitations.md), [cooperative-redaction-future.md](./cooperative-redaction-future.md)

---

## What this is

**Remove from this workspace** is a **limited-centralization** feature: it works when community traffic uses an **operator-controlled relay** (or local dev relay) that Obscur can treat as a managed workspace plane.

It is **not** the same as “delete for everyone” on open Nostr.

| Plane | Behavior |
|-------|----------|
| **Operator / custom relay** (Settings → operator trust, or `ws://localhost:7000` in dev) | Kind **5** hide is published to the community relay scope; **D1** suppress stops the relay (gateway + client filter) from serving that message id on live `REQ`/`EVENT`; peers on Obscur honor tombstones. |
| **Public decentralized relays** | No guarantee. Other clients, other relays, and earlier fetches may still retain events. UI stays honest: **Hide on this device** only (DM), or no remote remove on groups not on a managed relay. |

---

## When the UI shows “Remove from this workspace”

All must be true:

1. **Group / sealed community chat** (not DM).
2. Community **relay URL** matches **strict managed workspace** — operator-trusted relay in settings, or localhost workspace relay in dev ([`strict-managed-workspace.ts`](../../apps/pwa/app/features/groups/services/strict-managed-workspace.ts)).
3. **Outgoing message** — only messages **you sent** (`canDeleteMessageForEveryone`). Others’ messages: **Hide on this device** only.

DM threads never show remote remove in the current product (cooperative recall remains off on public Nostr).

---

## What “server-based” means here

- The **relay** (or relay + [Obscur gateway](../../apps/relay-gateway)) acts as the controlled distribution point for that workspace.
- Removal is **suppress on serve** + signed kind **5** hint — not erasure of every copy on the internet.
- Copies already on another device, another relay, or a backup stream **may still exist**; copy in UI says so (D3).

---

## User mental model (supported)

> If we run our own relay (or Obscur’s gateway in front of it), messages in **this** group on **this** relay can be removed from the workspace for connected Obscur clients. Public relays cannot promise that.

Future bands ([v1.8.9+ roadmap](../program/v1.8.9-plus-managed-workspace-roadmap.md)): D2 compaction, steward policies — not required for D1/D3 truth above.
