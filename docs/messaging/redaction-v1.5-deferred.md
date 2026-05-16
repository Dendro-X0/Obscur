# DM “Delete for Everyone” — v1.5.0 Deferred

**Decision (2026-05-15):** The product does **not** ship cooperative redaction in v1.5.0 UI.

---

## Why

1. **Multiple read models** (projection, IndexedDB, chat-state, controller memory) fought the same delete with different message ids.
2. **Nostr immutability** — redaction is cooperative hide, not erase; prior UX over-promised.
3. **Incremental patches** could not converge without ClientGateway owning one apply path (landed in code, UI still off).

Investigation: [investigation-delete-for-everyone.md](./investigation-delete-for-everyone.md).

---

## What exists in code (experimental)

- Receive pipeline classifies delete commands.
- `applyDmThreadRedaction`, display gate (`dm-redaction-display-gate.ts`).
- `pnpm verify:dm-redaction` unit/integration tests.

`DM_DELETE_FOR_EVERYONE_UI_ENABLED = false` in `apps/pwa/app/features/messaging/config/dm-redaction-product.ts`.

---

## What ships instead

- **Delete for me** — local suppression (supported).
- **Future:** [cooperative-redaction-future.md](./cooperative-redaction-future.md) (v1.6+).

---

## Maintainer note

Do not re-enable UI until v1.6 test gate passes. Do not mark release notes as “delete for everyone works.”
