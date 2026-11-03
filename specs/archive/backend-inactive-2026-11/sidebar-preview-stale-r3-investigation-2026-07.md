# Investigation — R3 Sidebar preview stale (`No messages yet`)

**Status:** Investigation complete (2026-07-04) — design slice next  
**Date:** 2026-07-04 (UTC)  
**Symptom:** Sidebar group row shows **“No messages yet”** while main thread is hydrated with group/DM history  
**Tracker:** [`docs/program/obscur-runtime-issue-tracker-2026-07.md`](../../docs/program/obscur-runtime-issue-tracker-2026-07.md) · queue **R3**  
**Handoff:** [`docs/handoffs/current-session.md`](../../docs/handoffs/current-session.md)  
**Related:** COM-RUN-02 sidebar placeholder (`group-room-key-missing` band) · R1 t4 residual · register `dm-ui-split-brain`

---

## Summary

R3 is a **display-only split-brain**: the **main thread** hydrates from SQLite / relay ingest (`workspace.thread.hydrate`, group thread append), but the **sidebar preview** reads `GroupConversation.lastMessage` from **metadata cache + membership ledger**, which is **not updated** when thread messages land.

Observed on **NewTest 2** (`groupId: b93f53e23d8c4456835afd3f4d3a627b`) during R1 t4 (`csess-94f4ca6d3332`): sidebar `No messages yet` while thread shows messages including `R1-room-key-health-t4-*` and prior group traffic.

This is **not** a send-blocker (R1 fixed health/send) and **not** auth (R2). Compose and thread history can be correct while sidebar preview stays empty.

---

## Symptom contract

| Field | Value |
|-------|--------|
| User action | Unlock → open chats → select **NewTest 2** (or any workspace group with SQLite thread history) |
| Expected | Sidebar preview shows latest message text (or invite/system summary) |
| Actual | Sidebar shows **“No messages yet”** (`messaging.noMessagesYet`) |
| Thread | Main pane shows hydrated messages / system cards |
| Proof tier target | **t4** — CodaCtrl surface probe: `mainThreadMessageCount > 0` + sidebar preview empty |
| Fixture | Tester1 · NewTest 2 · docker `:7000` · coordination `:8787` |
| Does not prove | DM-only split-brain (separate authority path); packaged NSIS; multi-window |

---

## Evidence inventory

### R1 t4 residual (primary)

| Source | Finding |
|--------|---------|
| `csess-94f4ca6d3332` snapshots | Sidebar: `NewTest 2` · `No messages yet` · thread hydrated |
| Handoff R1 row | “Residual: R3 sidebar still ‘No messages yet’ while thread hydrated” |
| `client_surface_probe` (R2 n3/n4) | `mainThreadMessageCount: 10` · group rows may still show empty preview |

### UI rendering path

| Surface | Owner | Input |
|---------|-------|--------|
| Sidebar preview text | `conversation-row.tsx` | `formatConversationMessagePreview(conversation.lastMessage)` → fallback `messaging.noMessagesYet` when empty |
| Group row data | `group-provider-legacy.tsx` → `resolveManagedWorkspaceGroupList` | `createdGroups` from workspace metadata cache + ledger synthesis |
| Ledger-only row | `toGroupConversationFromMembershipLedgerEntry` | `lastMessage: LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE` **or** persisted row with `lastMessage: ""` |
| Thread messages | `appendGroupThreadMessage` → SQLite | Dispatches `obscur:group-thread-messages-changed` — **no sidebar metadata update** |

### Parallel read models (root cause class)

```
Thread hydrate (SQLite / relay ingest)
        ↓
  useGroupThreadMessages / message-list
        ↓
  Main pane ✓

Metadata cache (workspace-kernel-group-metadata-store)
        +
Membership ledger (community-membership-ledger)
        ↓
  createdGroups[].lastMessage  (static / empty)
        ↓
  Sidebar preview ✗  → "No messages yet"
```

**No subscriber** connects `subscribeGroupThreadMessagesChanged` to `upsertGroupMetadata` / `createdGroups.lastMessage`. Contrast: DM sidebar merges via `dm-conversation-list-merge.ts` (`lastMessage: params.messagePreview`).

### COM-RUN-02 overlap (related, not identical)

[`com-run-02-membership-health-sidebar-investigation.md`](./com-run-02-membership-health-sidebar-investigation.md) documents **`Group key unavailable on this device`** placeholder when ledger synthesizes rows. R3 capture shows **`No messages yet`** — meaning `lastMessage` is **empty string** after `formatConversationMessagePreview`, not the ledger placeholder constant. Both share the same owner gap: **sidebar does not read thread truth**.

---

## Hypotheses

| ID | Hypothesis | Verdict |
|----|------------|---------|
| H1 | `createdGroups.lastMessage` never updated on group thread append/hydrate | **Likely primary** — no code path from `appendGroupThreadMessage` to metadata |
| H2 | Ledger placeholder overwritten by empty persisted metadata | **Contributing** — `resolveManagedWorkspaceGroupList` prefers persisted row; skips ledger when scope exists |
| H3 | DM conversation_list authority oscillation | **Out of scope for NewTest 2** — symptom is group row, not DM |
| H4 | SQLite read failure | **Rejected** — thread hydrates; probe shows messages |

---

## Canonical owners

| Concern | Canonical module | Notes |
|---------|------------------|-------|
| Sidebar group rows | `group-provider-legacy.tsx` · `workspace-kernel-list-port.ts` | List composition only |
| Group metadata persist | `workspace-kernel-group-metadata-store.ts` | `lastMessage` field exists but stale |
| Thread write | `group-thread-append.ts` | Should emit preview side-effect or event consumed by metadata owner |
| Preview format | `format-conversation-message-preview.ts` | Display only — not the bug |
| Ledger synthesis | `community-membership-ledger.ts` | Placeholder on ledger-only rows |

**Subtraction rule:** Do not patch `conversation-row.tsx` to read thread directly. Fix **one preview materialization owner** fed by thread truth.

---

## Remediation options (design — no code in this spec)

| Option | Owner | Description | Risk |
|--------|-------|-------------|------|
| **A — Thread event → metadata** | `group-provider-legacy.tsx` | Subscribe to `subscribeGroupThreadMessagesChanged`; upsert `lastMessage` + `lastMessageTime` from latest SQLite row | Must debounce; profile-scoped |
| **B — List-time hydrate** | `resolveManagedWorkspaceGroupList` or hook | When building sidebar, read latest group message from SQLite per conversation id | Read cost at list render; cache revision token |
| **C — Send/append inline** | `group-thread-append.ts` | After persist, call metadata upsert with plaintext prefix | Couples transport to UI metadata |
| **D — Unified materialization read model** | New thin module | Single `resolveGroupSidebarPreview(conversationId)` used by list + row | Best long-term; larger slice |

**Recommended:** **A** or **B** — smallest slice that closes the event loop without duplicating COM-RUN-02 health wiring.

---

## Proof plan (post-fix)

| Layer | Command / action |
|-------|------------------|
| **L1** | Unit: metadata upsert on `GroupThreadMessagesChanged` · preview non-empty when thread has rows |
| **L2** | Contract: `resolveManagedWorkspaceGroupList` does not emit empty `lastMessage` when SQLite thread non-empty |
| **L3** | MCP: unlock → Group tab → NewTest 2 → `client_surface_probe` |
| **L4** | Cold restart → unlock → sidebar preview matches last sent message without opening thread first |

### CodaCtrl capture sequence

1. `client_dev_environment_get` → `workspaceAligned: true`
2. `client_session_connect` `:9230` → Tester1 password unlock
3. Sidebar → **Group** → select **NewTest 2**
4. `client_surface_probe` — record `mainThreadMessageCount` vs sidebar preview text
5. `client_investigation_chain_create` `chain-r3-sidebar-preview-2026-07-04`
6. Optional: send `R3-sidebar-preview-t4-*` → re-probe sidebar updates

---

## Out of scope

- COM-RUN-01 roster divergence (accepted @ ACC-02)
- Membership health banner copy (R1)
- Community feature band PAUSED — **display-only** preview fix allowed under runtime repair R3
- Auto-fix ledger migration (RIW-1)

---

## Next step

1. Design spec: option A vs B with owner map + L1 tests  
2. Implement smallest slice  
3. t4 on NewTest 2 fixture · update register + CHANGELOG
