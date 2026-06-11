# Module 2 — Messaging (DM)

_Last reviewed: 2026-06-02 (baseline commit 7f84f813)._

**Status:** v1 complete (first-pass audit)  
**Last updated:** 2026-06-02  
**Scope:** `apps/pwa/app/features/messaging/`, DM controllers, main-shell DM integration, adjacent voice/request/vault paths

---

## 1. Scope

**Primary path:** `apps/pwa/app/features/messaging/` — **429** TS/TSX files, **~56k prod LOC** (total including tests ~88k per prior monorepo survey).

**Subfolder ownership:**

| Folder | ~Files | Owns |
|--------|--------|------|
| `services/` | 184 | Hydrate pipeline, persistence, message bus, requests, voice signaling, read authority, client-operations facade |
| `components/` | 67 | Chat view, message list, sidebar chrome, voice cards, composer |
| `lib/` | 53 | Upload, retry, message queue, NIP-96, sync checkpoints |
| `controllers/` | 36 | **v2** DM controller + pipelines; **v1** legacy still on disk |
| `utils/` | 30 | Persistence helpers, conversation IDs, commands |
| `hooks/` | 23 | `use-conversation-messages`, requests inbox, link preview |
| `providers/` | 10 | `messaging-provider`, **runtime transport owner**, projection unread |
| `local-dm-visibility/` | 4 | Delete-for-me visibility contract |
| `deletion/` | (under feature) | Delete coordinator, tombstones via gateway |
| `types/` | 1 | Shared messaging types |

**Largest prod files:**

| File | ~LOC | Role |
|------|------|------|
| `components/message-list.tsx` | 2,482 | Render + touch/scroll |
| `controllers/enhanced-dm-controller.ts` | 1,515 | **Legacy v1** — not live path |
| `controllers/incoming-dm-event-handler.ts` | 1,446 | Legacy incoming (superseded by v2 receive pipeline) |
| `components/chat-view.tsx` | 1,198 | Thread shell |
| `hooks/use-conversation-messages.ts` | 1,188 | React hook; delegates hydrate to pipeline |
| `controllers/v2/dm-controller.ts` | 1,104 | **Live transport owner hook** |
| `utils/persistence.ts` | 1,091 | Chat-state load/save, DM/group normalization |
| `providers/messaging-provider.tsx` | 944 | Conversation list, connections, chat-state |
| `services/message-persistence-service.ts` | 814 | Outbound SQLite + queue |
| `services/dm-read-authority-contract.ts` | 734 | Hydrate authority decisions |

**vs Module 1 (groups):** Messaging is **~15% larger** by prod LOC but **more evenly distributed** — groups concentrate ~15% of prod code in two files (`use-sealed-community`, `group-provider`).

---

## 2. Stated contract (canonical docs)

| Claim | Source |
|-------|--------|
| DM controller: `enhanced-dm-controller.ts` | `encyclopedia/04` — **stale** (see §5) |
| R1: DM visibility split across projection, chat-state, tombstones, relay — **collapse target** | Truth map § interim multiplicity |
| Native: SQLite authority for messages, list, tombstones; chat-state not read authority | `obscur-native-sqlite-policy.md` § Owner matrix |
| Hydrate choke: `dm-conversation-hydrate-pipeline.ts` + indexed scan | Policy P3b **done (code)** |
| Outbound persist: `message-persistence-service.ts` → `dbInsertMessage` | Policy P3b **done (code)** |
| Conversation list: `conversation-list-authority.ts` + `messaging-provider` | Policy P3a **done (code)** |
| 7-day relay lookback = **live subscription only**, not history TTL | P5-DM-3, `p5-persistence-survival-contract.md` |
| P5 bands complete @ 64 CI tests | `current-session.md`, `p5-persistence-survival-contract.md` |
| Enforcement honesty: residual dual paths, manual soak pending | `design-goals-and-constraints.md` §3 |
| Client mutations via gateway / `messagingClientOperations` — no parallel tombstone owners | Truth map R0, `messaging-client-operations.ts` header |

---

## 3. As-built ownership

### 3.1 DM **send** (outbound)

| Entry point | Production UI? | Notes |
|-------------|----------------|-------|
| `runtime-messaging-transport-owner-provider.tsx` | **Yes** | Single runtime singleton; gates on identity unlock + runtime phase |
| `controllers/v2/dm-controller.ts` → `sendDm` | **Yes** | Composes `dm-send-pipeline.ts` |
| `main-shell/hooks/use-chat-actions.ts` → `dmController.sendDm` | **Yes** | Main composer for DMs (attachments, reply) |
| `controllers/v2/dm-send-pipeline.ts` | Internal | Publish + persist orchestration |
| `controllers/outgoing-dm-orchestrator.ts` / `outgoing-dm-publisher.ts` | **Legacy** | Large files; v2 intended replacement |
| `controllers/enhanced-dm-controller.ts` | **Legacy** | Still referenced in legacy test pack; re-exported as v2 via `use-enhanced-dm-controller.ts` |

**Finding:** **One live send funnel** for production UI (v2 controller). Legacy v1 remains on disk and in `test:legacy:messaging`.

### 3.2 DM **persist**

| Entry point | Store | Notes |
|-------------|-------|-------|
| `services/message-persistence-service.ts` | SQLite (`dbInsertMessage`, `dbUpsertConversation`) | Primary native write; also message bus integration |
| `services/chat-state-store.ts` | localStorage | Mirror / web; `ChatStateDurabilityOwner` flush on hide |
| `controllers/v2/dm-receive-pipeline.ts` | → persistence service | Inbound path |
| `services/dm-local-delete-persistence.ts` | SQLite tombstones | Delete-for-me |
| `messagingClientOperations` / gateway ports | Facade | Routes deletes, suppressions, hydrate |

**Finding:** Policy-aligned **single write service** for SQLite; chat-state fallback **disabled on native hydrate** (`dm-conversation-hydrate-pipeline.ts` L199–209: `!requiresSqlitePersistence()` for persisted fallback).

**Caveat:** Some SQLite writes still use `.catch(() => {})` fire-and-forget in persistence service (same class of bug as group messages had); P5-DM-1 tests assert write **is called**, not process-kill durability.

### 3.3 DM **hydrate / display**

| Entry point | Role |
|-------------|------|
| `hooks/use-conversation-messages.ts` | React state, message bus subscription, **calls** hydrate pipeline |
| `services/dm-conversation-hydrate-pipeline.ts` | **Orchestration owner** — tombstones → indexed scan → assemble read model |
| `services/dm-conversation-hydrate-indexed-scan.ts` | SQLite window load; multi-profile slot scan |
| `services/dm-read-authority-contract.ts` | Which source wins (projection vs persisted vs indexed) |
| `services/dm-conversation-hydrate-read-model.ts` | Merge/cap/overlay assembly |
| `account-sync` projection selectors | Live overlay + evidence rows |
| `services/message-bus.ts` | Realtime delivery to UI |
| `main-shell.tsx` | Wires `useConversationMessages` for selected DM |

**Finding:** Unlike groups, DM has an **explicit documented hydrate pipeline** with a single orchestration module. R1 multiplicity is **partially collapsed** at the choke point, but hook still owns overlay/diagnostics assembly (truth map: exit criterion not fully met).

**Groups explicitly excluded:** `use-conversation-messages` skips `isGroupConversationId` — group threads use `use-sealed-community` instead.

### 3.4 DM **delete / tombstones**

| Entry point | Role |
|-------------|------|
| `deletion/message-deletion-coordinator.ts` | Coordinator |
| `controllers/v2/dm-controller.ts` | `deleteMessage`, delete-for-everyone |
| Gateway `messageDeleteTombstones` port | Native SQLite tombstones |
| `messagingClientOperations.deleteDmForMe` | Canonical client entry |
| `services/apply-dm-thread-redaction.ts` | Display gate after delete |

### 3.5 **Conversation list** (sidebar DMs)

| Entry point | Role |
|-------------|------|
| `providers/messaging-provider.tsx` | `createdConnections`, hydrate, chat-state |
| `services/conversation-list-authority.ts` | Native → SQLite list authority |
| `main-shell` + `use-filtered-conversations.ts` | Merge with groups |
| `components/sidebar.tsx` | Renders DM section |

### 3.6 **Requests / invites** (DM-adjacent)

| Entry point | Role |
|-------------|------|
| `hooks/use-requests-inbox.ts` | ~685 LOC — request inbox state |
| `services/request-transport-service.ts` | Contact request transport |
| `lib/dms/use-requests-inbox.ts` | Supporting hooks |
| Community invite DMs | `groups/services/community-dm-invite-pipeline.ts` — **cross-module** |

### 3.7 **Voice / media** (shipped, separate durability)

| Entry point | Role |
|-------------|------|
| `services/realtime-voice-*` | Call signaling, UI store |
| `components/voice-note-card.tsx`, `voice-call-invite-card.tsx` | UI |
| `services/call-record-sqlite-store.ts` | ACC-04 native call records |
| `lib/nip96-upload-service.ts` | Attachments upload |

Voice is **not** fully unified with DM message persistence; ACC-04 gates call record SQLite separately.

---

## 4. Why DM works better than groups (concrete differences)

| Dimension | DM (Module 2) | Groups (Module 1) |
|-----------|-----------------|-------------------|
| **Live transport owner** | Single `RuntimeMessagingTransportOwnerProvider` → v2 controller | Multiple: `use-chat-actions` + `use-sealed-community` (+ route duplicates) |
| **Hydrate pipeline** | Named pipeline module + indexed scan + authority contract | Logic inside 3.4k-line hook; no equivalent pipeline file |
| **Native policy enforcement** | chat-state hydrate fallback **off** on native | SQLite first but chat-state fallback + mirror still active |
| **Client gateway facade** | `messagingClientOperations` + R0 gateway ports | Group ops partially via `group-client-operations`; less centralized |
| **CI survival gates** | P5-DM-1/2/3 in `verify:p5-persistence` | P5-COM bands for **membership/list**, not message cold restart |
| **Doc/code on live path** | Enc. 04 stale on controller **name**, but v2 is wired and commented | Enc. 10 “stable” vs observed multiplicity |
| **Legacy code** | v1 controller **re-exported** to v2; legacy tests isolated | Parallel paths still used in production (send split) |
| **Projection / event log** | Account events for DM; bootstrap seal-only on native | Community ledger + coordinator + CRDT + relay |

**Summary:** DM went through a **v2 pipeline refactor** with explicit persistence policy bands and CI gates. Groups received SQLite helpers but retained **split send/display/persist owners** without an equivalent survival contract test.

---

## 5. Doc vs code conflicts

| Doc says | Code / evidence says | Severity |
|----------|----------------------|----------|
| Enc. 04: controller = `enhanced-dm-controller.ts` | Live path = `controllers/v2/dm-controller.ts` via `runtime-messaging-transport-owner-provider.tsx`; shim documents v1 deprecated | **Med** (doc drift) |
| R1 collapsed to one read-model | Truth map: hook still owns overlay + diagnostics; ~12 hydrate-related services remain | **Med** (partial) |
| P3b/P5 “done” | Design goals: manual two-profile soak **pending** | **Low** (process gap) |
| Gateway-only mutations | Some legacy controllers/tests still import old paths | **Low** |
| DM history “7-day delete” user myth | Default retention unlimited; 7d is relay **subscribe** window — documented in P5 | **N/A** (user education) |

---

## 6. Remaining multiplicity / known gaps (R1 interim)

Truth map R1 still lists split across:

- `use-conversation-messages` (hook)
- Account projection / reducers
- chat-state persisted fallback (**web only** on native)
- Durable delete tombstones
- Relay replay

**Collapsed at:** `dm-conversation-hydrate-pipeline.ts`, `dm-read-authority-contract.ts`, `messagingClientOperations`.

**Not collapsed:**

- Legacy v1 controller files (~2.5k+ LOC combined) still in tree
- Projection overlay merge inside hook
- `test:legacy:messaging` script still runs v1-era tests
- Fire-and-forget patterns in some SQLite write paths (needs audit parity with group fix)

---

## 7. Test & CI coverage

**`pnpm verify:p5-persistence`** includes (DM-relevant):

- `dm-conversation-hydrate-indexed-scan.test.ts` — P5-DM-2 (8-day-old row survives)
- `message-persistence-service.test.ts` — P5-DM-1
- `p5-persistence-authority-gates.test.ts` — P5-DM-3 lookback grep, P5-BKP-1 native restore strip
- `encrypted-account-backup-service.native-restore.test.ts`
- `restore-merge-chat-state.native.test.ts`
- Plus group P5-COM tests and ACC-03/04 relay/call stores

**Integration / deterministic tests (DM):**

- `use-conversation-messages.integration.test.ts`
- `request-transport-deterministic.integration.test.ts`
- `dm-delivery-deterministic.integration.test.ts`
- `controllers/v2/dm-delete-pipeline.test.ts`
- Many unit tests under `services/` and `controllers/v2/`

**Missing vs ideal:**

- Full process-kill / cold restart E2E (desktop Tauri) — same gap as groups but **more unit/integration coverage** than groups
- Legacy vs v2 parity test explicitly asserting v1 is never mounted in production shell
- Voice call convergence — called out in Enc. 04 as active hardening

**Groups comparison:** DM has **P5-DM-* CI gates**; groups lack **P5-COM-MSG** equivalent for message cold restart.

---

## 8. Cross-dependencies

| Module | How messaging uses it |
|--------|------------------------|
| **Profiles** | `getResolvedProfileId`, multi-slot scan, profile bus, gateway install |
| **Relays** | `enhanced-relay-pool`, `dm-relay-transport.ts`, publish copy |
| **Account sync** | Projection overlay, bootstrap seal-only, event ingest bridge, backup restore |
| **Network** | Blocklist, peer trust, requests — wired into v2 controller |
| **Main shell** | `useChatActions`, `useConversationMessages`, chat view |
| **Groups** | Shared `chat-state-store`, `message-bus`; group send **bypasses** DM controller |
| **Vault** | Attachment cache, CAS recovery reads chat-state as evidence |
| **Runtime** | Transport owner gated on `window-runtime-supervisor` phase |

---

## 9. Hypotheses (not proven)

1. User-perceived DM reliability comes from **v2 single transport owner + hydrate pipeline**, not from fewer total files.
2. Residual DM bugs likely cluster in **projection overlay timing**, **multi-window profile slots**, and **voice** — not basic send/receive.
3. **Legacy v1 code** is dead weight that confuses agents and maintainers (Enc. 04 drift symptom).
4. Applying group-style **await + durability owner** to any remaining fire-and-forget DM writes would close the last parity gap with groups fix.

---

## 10. Open questions for synthesis

1. Can Path A (DM-only ship) **delete** v1 controllers and legacy test pack without losing CI signal?
2. Is R1 “done enough” for v1.9.x exit, or does hook overlay ownership block ship claims?
3. Should **`verify:p5-persistence`** be renamed/split into DM vs COM bands for clearer fork decisions?
4. What is the minimum group code path that must remain for **community invite DMs** if group chat UI is removed?
5. Does DM’s gateway facade become the **template** for a hypothetical group rewrite, or is groups too different (relay sealed events)?

---

## 11. References

**Code (anchors):**

- `apps/pwa/app/features/messaging/providers/runtime-messaging-transport-owner-provider.tsx`
- `apps/pwa/app/features/messaging/controllers/v2/dm-controller.ts`
- `apps/pwa/app/features/messaging/services/dm-conversation-hydrate-pipeline.ts`
- `apps/pwa/app/features/messaging/services/message-persistence-service.ts`
- `apps/pwa/app/features/messaging/services/messaging-client-operations.ts`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- `apps/pwa/app/features/messaging/providers/messaging-provider.tsx`
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`

**Docs:**

- `docs/encyclopedia/04-messaging-and-groups.md`
- `docs/encyclopedia/12-core-architecture-truth-map.md` (R0, R1, row 9)
- `docs/program/obscur-native-sqlite-policy.md`
- `docs/program/p5-persistence-survival-contract.md`
- `docs/program/design-goals-and-constraints.md` §3

**Prior module:**

- [01-community-groups.md](./01-community-groups.md) — contrast table in §4

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | v1 — first-pass audit |
