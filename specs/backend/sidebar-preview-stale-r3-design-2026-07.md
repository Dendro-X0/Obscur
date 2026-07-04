# Design — R3 sidebar preview list-time SQLite hydrate (Option B)

**Status:** Approved for implementation (2026-07-04)  
**Investigation:** [sidebar-preview-stale-r3-investigation-2026-07.md](./sidebar-preview-stale-r3-investigation-2026-07.md)  
**Chain:** `chain-r3-sidebar-preview-2026-07-04`

---

## Problem

Group sidebar rows read `GroupConversation.lastMessage` from workspace metadata + membership ledger. Group thread messages persist to SQLite and hydrate the main pane, but **no owner updates metadata preview fields** on append/hydrate. Result: **“No messages yet”** while thread is populated.

---

## Design decision

**Option B — list-time SQLite hydrate** (maintainer choice):

When composing the sidebar group list under workspace-kernel authority, **backfill stale previews** from the latest SQLite group thread row (`loadGroupThreadPageFromSqlite`, `pageSize: 1`).

**Not chosen:** Option A (thread event → metadata upsert) — valid follow-up; Option B avoids metadata write churn and keeps preview read ephemeral.

**Subtraction rule:** Do not read thread SQLite from `conversation-row.tsx`. Single module owns preview materialization; provider applies patches to `createdGroups`.

---

## Stale preview contract

Treat `lastMessage` as stale when:

1. Empty / whitespace-only after trim, **or**
2. Equals `LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE` (`Group key unavailable on this device`)

When stale and SQLite has a latest plaintext row, patch:

- `lastMessage` ← trimmed plaintext
- `lastMessageTime` ← row timestamp

Do **not** persist hydrated preview to metadata cache in this slice (display-only overlay).

---

## Owner map

| Concern | Owner |
|---------|--------|
| Stale detection + SQLite read | `group-sidebar-preview-sqlite-hydrate.ts` (new) |
| List composition (sync) | `workspace-kernel-list-port.ts` (unchanged) |
| Apply hydrate to React state | `group-provider-legacy.tsx` |
| Thread SQLite read | `group-thread-sqlite-store.ts` (`loadGroupThreadPageFromSqlite`) |
| Thread change signal | `group-thread-messages-changed.ts` → re-hydrate list |

---

## Implementation slice

1. Add `isStaleGroupSidebarPreview`, `hydrateGroupSidebarPreviewFromSqlite`, `hydrateGroupSidebarPreviewsFromSqlite`.
2. In `group-provider-legacy.tsx`:
   - Initial hydrate + `refreshDisplayFromMetadataCache` → async SQLite backfill when workspace-kernel authority.
   - Subscribe to `subscribeGroupThreadMessagesChanged` (profile-scoped) → re-run backfill.
3. L1 unit tests with mocked `loadGroupThreadPageFromSqlite`.

---

## Proof plan

| Layer | Command / action |
|-------|------------------|
| **L1** | `pnpm -C apps/pwa exec vitest run app/features/groups/services/group-sidebar-preview-sqlite-hydrate.test.ts` |
| **L3** | MCP unlock → Group tab → NewTest 2 → `client_surface_probe` |
| **L4** | Cold restart → unlock → sidebar preview non-empty before opening thread |

### CodaCtrl capture

1. `client_session_connect` `:9230` → Tester1 password unlock  
2. Sidebar Group → **NewTest 2** (`b93f53e23d8c4456835afd3f4d3a627b`)  
3. `client_surface_probe` — sidebar preview ≠ “No messages yet” when `mainThreadMessageCount > 0`  
4. Chain `chain-r3-sidebar-preview-2026-07-04`

---

## Out of scope

- Metadata cache persistence of preview fields  
- DM sidebar authority (separate path)  
- COM-RUN-01 roster divergence
