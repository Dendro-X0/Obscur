# Module 1 — Community / groups

_Last reviewed: 2026-06-02 (baseline commit 7f84f813)._

**Status:** v1 complete (first-pass audit)  
**Last updated:** 2026-06-02  
**Scope:** `apps/pwa/app/features/groups/`, `apps/pwa/app/groups/`, cross-cutting community paths in messaging/account-sync

---

## 1. Scope

**Primary paths:**

- `apps/pwa/app/features/groups/` — 333 TS/TSX files (~54k LOC total)
- `apps/pwa/app/groups/` — 11 route/shell files (community home, leave, purge, block)

**Scale (approx, prod + test):**

| Metric | Value |
|--------|-------|
| Total files | 333 |
| Prod files | ~195 |
| Test files | ~138 |
| Prod LOC | ~36,500 |
| Test LOC | ~17,900 |
| vs messaging feature | ~61% of messaging total LOC |

**Largest prod files (concentration risk):**

| File | ~LOC | Role |
|------|------|------|
| `hooks/use-sealed-community.ts` | 3,379 | Relay ingest, messages, membership, governance, send |
| `providers/group-provider.tsx` | 2,149 | Sidebar list, hydrate, leave/join orchestration |
| `components/community-invite-card.tsx` | 1,039 | Invite accept/join |
| `components/group-management-dialog.tsx` | 998 | Management UI |

**Subfolder ownership:**

| Folder | ~Files | Owns |
|--------|--------|------|
| `services/` | 233 | Ledger, coordinator, relay ingress, SQLite group **list**, sealed message persistence, governance, leave outbox, `group-service.ts` signing |
| `components/` | 47 | Create/discover/manage UI, invite cards |
| `utils/` | 27 | Conversation IDs, invite lifecycle, message mapping |
| `hooks/` | 20 | `use-sealed-community`, CRDT/truth/roster hooks |
| `providers/` | 3 | `group-provider` |
| `controllers/` | 1 | Group delete subscription (kind-5 tombstones) |

---

## 2. Stated contract (canonical docs)

| Claim | Source |
|-------|--------|
| One owner per lifecycle; no second mutation owner | `encyclopedia/10`, `12` rows 10 + R2 |
| Group lifecycle/persistence: `group-provider.tsx` | Truth map row 10 |
| Community runtime (sealed ingest/publish): `use-sealed-community.ts` | Enc. 10, Enc. 04 |
| Membership recovery: `community-membership-recovery.ts` | Truth map row 10 |
| Recovery precedence: tombstones → ledger → chat-state fallback | Enc. 10 |
| Send requires: joined membership + group record + room key | Enc. 10 |
| Native: SQLite durable; chat-state not message read authority | `obscur-native-sqlite-policy.md`, design goals §3 |
| Public-relay community membership **infeasible**; Path A (DM-only) or Path B (coordination workspace) | `community-fork-decision-2026-05.md` |
| R2 multiplicity: roster/participants still merged from several surfaces — **collapse target, not done** | Truth map § interim multiplicity |
| Enc. 10: “Create/join/leave/recover **stable**”; “no severe open blocker” | Conflicts with Enc. 19 draft + user evidence |

---

## 3. As-built ownership

### 3.1 Group message **send**

| Entry point | Production UI? | Notes |
|-------------|----------------|-------|
| `main-shell/hooks/use-chat-actions.ts` → send handler | **Yes** — main composer | `GroupService.sendSealedMessage` → `publishGroupEvent` → `commitSealedGroupMessages` → `messageBus` |
| `hooks/use-sealed-community.ts` → `sendMessage` | Partial | Same signing + persist; different publish helper; used from group-home / hook consumers, **not** main composer |
| `services/group-service.ts` | Low-level | All sealed/NIP-29 event construction |
| `messaging/components/global-dialog-manager.tsx` | Create flow | `sendSealedCommunityCreated` — not chat text |
| `components/community-invite-card.tsx` | Join | `sendNip29Join` / `sendSealedJoin` — membership, not chat |

**Finding:** Two live stacks for **chat text** with different publish and optimistic semantics.

### 3.2 Group message **persist**

| Entry point | Store | Notes |
|-------------|-------|-------|
| `services/sealed-group-message-persistence.ts` → `commitSealedGroupMessages` | SQLite + chat-state | Declared canonical post-relay write |
| `persistSealedGroupMessages` | chat-state only | **No-op on native** when `requiresSqlitePersistence()` |
| `services/community-group-sqlite-store.ts` | SQLite | Group **list** rows only — not message bodies |
| `messaging/services/chat-state-store.ts` | localStorage | `groupMessages`, `createdGroups` |
| `account-sync/.../encrypted-account-backup-service.ts` | Backup restore | Native restore **strips group message bodies** (tested) |
| `components/sealed-group-message-durability-owner.tsx` | Flush pending SQLite | Mounted in `providers.tsx`; pagehide/beforeunload |

**Finding:** Message bodies touch SQLite, chat-state, relay, and in-memory hook state; list metadata can persist when bodies do not.

### 3.3 Group message **display / hydrate**

| Entry point | Role |
|-------------|------|
| `use-sealed-community.ts` | Relay `onEvent` → decrypt → merge → persist; cold `loadPersistedSealedGroupMessages` |
| `main-shell.tsx` | Maps `groupState.messages` → chat UI when group selected (not on `/groups/[...id]` home) |
| `groups/[...id]/group-home-page-client.tsx` | **Second** `useSealedCommunity` instance |
| `utils/map-sealed-group-messages-to-chat.ts` | Sealed records → unified `Message[]` |
| `messaging/hooks/use-conversation-messages.ts` | **Explicitly skips** group conversation IDs |
| `controllers/community-delete-subscription.ts` | Relay delete → suppression |

**Finding:** Up to **two hook instances** per group (shell chat vs community home); DM hydrate pipeline **does not** own groups.

### 3.4 Membership truth (join / leave / roster)

| Entry point | Role |
|-------------|------|
| `services/community-membership-ledger.ts` | Durable local ledger |
| `services/community-membership-mutation-owner.ts` | Intended single mutation writer |
| `services/community-membership-coordinator.ts` | Merge ledger + chat-state + SQLite list + evidence |
| `providers/group-provider.tsx` | `hydrateGroupsForPublicKey`, sidebar `createdGroups` |
| `hooks/use-sealed-community.ts` | Live relay membership replay |
| `hooks/use-community-membership-crdt.ts` | Comment: replaces snapshot membership — **parallel path** |
| `hooks/use-community-membership-truth.ts` | Coordination directory (Path B) |
| `services/apply-community-membership-ingress.ts` | Relay gossip ingress |
| `components/community-invite-card.tsx` | Join on invite accept |
| `services/community-leave-outbox.ts` | Durable leave retry |
| `groups/leave/page.tsx`, settings destructive actions | Route-level leave |

**Finding:** More parallel owners than message chat; truth map R2 acknowledges roster multiplicity.

### 3.5 Group list (sidebar)

| Entry point | Role |
|-------------|------|
| `group-provider.tsx` → `createdGroups` | In-memory authoritative list |
| `community-group-sqlite-store.ts` | Native SQLite group rows |
| `services/group-list-authority.ts` | Native → SQLite authority; web → chat-state |
| `main-shell.tsx` + `use-filtered-conversations.ts` | Merge DMs + groups for sidebar |
| `messaging/components/sidebar.tsx` | Renders communities section |
| chat-state `createdGroups` | Persisted list mirror |

**Finding:** Sidebar row can show “last activity” from overrides/metadata while thread hydrate is empty — **observed in Test 10**.

---

## 4. Persistence & truth

| Store | Docs say | Observed for group **messages** | Observed for group **list** |
|-------|----------|--------------------------------|-----------------------------|
| SQLite (`group_messages`) | Native authority | Write path existed as fire-and-forget async; durability owner added in code (not exploration-verified at runtime) | Separate table via `community-group-sqlite-store` |
| chat-state `groupMessages` | Mirror / web fallback | Survives page refresh; keyed by profile scope + conversation id aliases | N/A |
| chat-state `createdGroups` | Interim list on native | Sidebar metadata | Primary web fallback |
| Relay subscription | Delivery + replay | Needs room key to decrypt; `limit: 100` on subscribe | Membership events separate from message bodies |
| In-memory `useSealedCommunity` state | Not durable | Session truth for UI | N/A |
| Membership ledger | Canonical for recovery precedence | Independent of message thread | Drives which groups appear |

**User-reported pattern (Test 10):**

- Live: messages visible (relay + session state)
- Page refresh: sometimes partial retention (chat-state / single relay event)
- Full app restart: often empty thread; sidebar metadata may remain

**Hypothesis (consistent with architecture):** List lifecycle and message lifecycle are decoupled; native SQLite message path was not reliably awaited before process exit; no CI gate proves cold restart.

---

## 5. Doc vs code conflicts

| Doc says | Code / evidence says | Severity |
|----------|----------------------|----------|
| Enc. 10: flows stable, no severe blocker | Enc. 19 draft: member truncation, placeholder names; user: message loss on restart | **High** |
| One owner per lifecycle (Enc. 10, 12) | Two send paths; two+ `useSealedCommunity` instances; R2 roster multiplicity | **High** |
| Native SQLite = message authority (policy) | chat-state still used as fallback; backup strips bodies on native restore | **Med** |
| Fork decision: public-relay membership closed | Large relay + DM-adjunct membership code still present | **Med** |
| P3 persistence “done in code” (design goals) | Enforcement honesty table: residual dual paths, soak not done | **Med** |
| `use-community-membership-crdt` “replaces” sealed-community for membership | Both exist | **Med** |

---

## 6. Test & CI coverage

**Present (membership / list):**

- `group-provider.test.tsx` — list hydrate from ledger / inferred from `groupMessages`
- `group-provider.cross-device-membership.integration.test.tsx`
- `community-phase3-m4-membership-replay.test.ts` — membership after restart replay
- Many `services/community-*.test.ts` — policy/reducer units

**Present (messages, unit only):**

- `sealed-group-message-persistence.test.ts` — round-trip, alias load, sqlite+chat-state commit (mocked)

**Missing (user-visible):**

- Send → process exit → reopen → thread populated (integration/e2e)
- Parity: `use-chat-actions` vs `useSealedCommunity.sendMessage` durable outcome
- Dual hook instances (main-shell vs group-home) — diverge or double-persist
- Cold restart gate in CI analogous to P5 DM hydrate tests

**CI gates:**

- `pnpm verify:p5-persistence` — **DM-heavy**; group message cold restart **not** equivalent gate
- `verify:stability` — render/shell; not message durability

---

## 7. Hypotheses (not proven in this audit)

1. **Refresh vs restart gap** is primarily async SQLite + profile-scoped chat-state keys, not relay loss (Docker relay can still hold events).
2. **Duplicate messages in live UI** (e.g. four “test” lines) may be relay replay + optimistic + hydrate merge without strict dedupe at UI boundary.
3. **Removing group chat UI (Path A)** is a smaller cut than deleting `features/groups/` entirely — invite/network surfaces may still need partial group code for legacy threads.
4. **Path B** (coordination-owned roster) is partially implemented but coexists with legacy relay/DM paths — finishing Path B without subtraction increases path count.

---

## 8. Open questions for synthesis

1. Minimum **Path A** surface hide list vs maximum code deletion — what breaks DM invites referencing communities?
2. Can group **list** be kept (read-only legacy) while group **chat composer** is removed?
3. Does `verify:p5-persistence` need a COM-MSG band or is community out of v1.9.x scope entirely?
4. Is `use-sealed-community.ts` splittable in theory, or mandatory rewrite if community stays?
5. What does encrypted backup restore **strip** for groups on native — acceptable for “DM-only ship”?

---

## 9. References

**Code (anchors):**

- `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
- `apps/pwa/app/features/groups/providers/group-provider.tsx`
- `apps/pwa/app/features/groups/services/sealed-group-message-persistence.ts`
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`
- `apps/pwa/app/features/main-shell/main-shell.tsx`
- `apps/pwa/app/groups/[...id]/group-home-page-client.tsx`

**Docs:**

- `docs/encyclopedia/10-community-and-groups-overhaul.md`
- `docs/encyclopedia/12-core-architecture-truth-map.md` (R2)
- `docs/encyclopedia/19-community-data-integrity-spec.md`
- `docs/program/community-fork-decision-2026-05.md`
- `docs/program/obscur-native-sqlite-policy.md`
- `docs/communities/membership-sync-architecture.md`
- `docs/program/design-goals-and-constraints.md` §3 enforcement honesty

**Prior research (same session, not duplicated here):**

- Conversation history: group message persistence investigation, refresh vs restart pattern

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-02 | v1 — first-pass audit from codebase + doc cross-check |
