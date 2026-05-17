# Kernel & transport sketch (gradual)

_Last reviewed: 2026-05-15 (baseline commit 0797ce1c)._

**Status:** Draft — no implementation gate  
**Last updated:** 2026-05-16

---

## Gradual path (do not big-bang rewrite)

```text
Phase 0 (now)     Obscur app + ClientGateway + Nostr adapter (v1.5.x)
Phase 1           Document TransportPort; freeze feature imports of @dweb/nostr in apps/pwa
Phase 2           Team-server adapter sketch (optional DM fanout) — dogfood internally
Phase 3           Kernel charter stable; reference client = Obscur; Nostr adapter maintained
```

Each phase **leaves assets** in the monorepo: tests, UI kit, crypto, CRDT experiments, gateway ports.

---

## Transport port (conceptual API)

Not a code contract yet — a direction for when we extract a dedicated transport package (alongside existing gateway packages) or similar:

```typescript
// Conceptual — not checked in
interface TransportPort {
  readonly kind: "nostr" | "team_relay" | string;
  publishEnvelope(params: OutboundEnvelope): Promise<PublishResult>;
  subscribeInbound(handler: InboundHandler): Unsubscribe;
}
```

**Kernel** consumes decrypted **semantic events** (message, recall_command, membership, …).  
**Adapter** maps wire formats (Nostr kind 4/1059, custom JSON, …) to those events.

---

## What stays in the application layer

- React UI, routing, theming (`ui-kit`, `apps/pwa`)
- Tauri shell, updater, Tor, tray (`apps/desktop`)
- Onboarding, settings UX, release channels
- Profile picker, multi-window desktop behavior

---

## What migrates toward kernel over time

| Current location | Kernel concern |
|------------------|----------------|
| `@dweb/crypto` | Identity, E2E primitives |
| `@dweb/core` / profile bus patterns | Profile-scoped event isolation |
| `@dweb/storage-contracts` | Tombstone, visibility, retention |
| `@dweb/client-gateway` | Client-facing port surface (may split kernel vs app ports) |
| Account projection / event log | Durable timeline semantics |
| `local-dm-visibility`, deletion coordinator | Visibility & recall semantics |

---

## Lessons already paid for (encode in kernel later)

| Lesson | Kernel implication |
|--------|-------------------|
| Global `messageBus` without profile id | All events carry `profileId`; subscribers filter |
| Account-sync restore after local delete | Tombstone beats backup replay |
| “Delete” UI on immutable relay | Cooperative recall is a command + hide, not erase |
| Dedup before delete classification | Classify control messages before dedup |
| Multiple hydrate owners | Single materialization owner per thread |

These are implemented or being fixed in the Nostr client; the charter should **codify** them so the next adapter does not rediscover them.

---

## Non-goals for kernel v0

- Replacing Nostr in v1.5.x.
- Public blockchain, token, or federation spec before one team-server adapter works.
- Promising ad-tech immunity beyond “we do not implement it.”
