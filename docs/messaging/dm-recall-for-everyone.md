# DM recall for everyone (cooperative redaction)

**Last updated:** 2026-05-16  
**Product status:** **UI removed** — `DM_RECALL_FOR_EVERYONE_UI_ENABLED = false` in `dm-local-visibility-product.ts`. Not shipped as a user-facing feature because Nostr cannot guarantee cross-client behavior.  
**Ingress:** Obscur may still apply cooperative hide when a peer sends a delete command over DM.  
**Not the same as:** server-side hard delete, Nostr event erasure, or guaranteed removal on all clients.

---

## What users should expect

| User mental model | What Obscur actually does |
|-------------------|---------------------------|
| “Unsend like WhatsApp” | Sends a **signed delete command** over the same DM transport; cooperating Obscur clients **hide** matching rows locally. |
| “Gone from the relay forever” | Relays store **immutable** events; a recall command does not erase prior copies already fetched. |
| “Works on every app” | Only clients that implement the same `__dweb_cmd__delete` contract apply the hide. |

**Hide on this device** only affects the local shell. **Recall for everyone** asks the peer’s Obscur (and your other devices after sync) to apply the same cooperative hide when they process the command.

---

## Protocol (high level)

1. Sender publishes a DM carrying the delete command payload (targets: message id / event id / derived aliases).
2. Recipient ingress resolves targets (`expandDmDeleteIdsForThread`) and runs `applyDmThreadRedaction`.
3. Local shell applies suppression + optional destructive cleanup; UI updates via message bus.

This matches the v1.3.15 *felt* behavior (message disappears in-thread) without claiming objective deletion.

---

## Performance notes (v1.5.1+)

- **Hide on this device:** tombstone + UI update are **synchronous**; account projection replay and IndexedDB/SQLite cleanup run in the **background**.
- **Recall for everyone:** chat list updates **before** network publish finishes; relay send and durable purge continue asynchronously.

---

## Limitations (honest)

- Peers offline or on old builds may keep showing plaintext until they upgrade or receive the command.
- Backup restore may reintroduce rows unless suppression contracts in [deletion-roster-limitations.md](./deletion-roster-limitations.md) apply.
- Voice-note / attachment-only messages may have stricter recall rules (see `message-delete-permissions`).

---

## Related code

- UI copy: `apps/pwa/app/features/messaging/config/dm-local-visibility-product.ts`
- Sender path: `dm-controller` → `deleteMessageForEveryone` → relay publish
- Receiver path: `apply-dm-thread-redaction.ts`
- Local durability: `local-dm-visibility-owner.ts`
