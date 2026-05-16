# Decentralized messaging: deletion, roster persistence, and architectural limits

**Last updated:** 2026-05-14  
**Audience:** maintainers, support, and product — DM/community delete behavior and cross-surface sync expectations.

**Refactor execution order (deferred for day-to-day work):** `docs/program/v1.5.0-architecture-refactor-queue.md` (R1 message materialization, R2 community OR-set).

## Accepted limitation (2026-05-14) — investigation closed

**Status:** **DM-001 is not treated as fixable** with incremental patches on the current stack. Further debugging on “delete for me then refresh” is **deprioritized** until a dedicated architecture milestone completes (single DM materialization owner + restore contract that never re-imports tombstoned timeline rows).

### What users may see (product truth)

| Expectation | Actual behavior today |
|-------------|------------------------|
| “Delete for me” removes the message permanently | Message may **reappear** after refresh, app restart, or **Account restore** |
| Web and Desktop with the **same account** show the same DM thread | Timelines can **diverge**; delete on one surface may not hide on the other until backup/tombstones align |
| Delete syncs to the cloud like a server app | Delete is **local suppression** (tombstones + projection); relay backup may still carry older history |

### Suggested user-facing language (until refactor ships)

- Prefer **“Hide on this device”** or **“Remove from this chat (local)”** over **“Delete”** where the action is delete-for-me only.
- Short help note: *Messages you hide on this device may reappear after a refresh or on another device while your account syncs. This is a known limitation of the current release.*

### Maintainer policy

- **Do not** block unrelated features on re-opening DM-001.
- **Do not** claim in release notes that delete-for-me is fixed unless verified under the full R1 exit criteria in the refactor queue.
- Re-open only when **`docs/program/v1.5.0-architecture-refactor-queue.md` R1** is marked complete **and** manual A/B replay passes on Web + Desktop.

### Why this is a Catch-22 (documented, not actionable day-to-day)

- **Finishing the architecture rewrite** stalls on the last ~5% (multiplicity, restore, identity) while other work needs the app shippable.
- **Patching the legacy architecture** repeatedly fails to hold across refresh because multiple stores and backup convergence still own overlapping lifecycles.

---

## Protocol reality (cannot be “fixed” by local UX alone)

- **Nostr events are immutable on the wire.** Any “delete for everyone” is a *new* signed command or replace-style workflow that **other clients must interpret**. Peers who ignore it, or who fetched the event before the command, may still show the plaintext. This is not equivalent to a centralized server hard-deleting a row.
- **Real-time consistency does not exist by default.** Subscriptions, relay fan-out, and bootstrap ordering mean the same logical thread can be observed in different orders or with partial gaps. The product must treat relay timelines as **evidence streams**, not authoritative single sources of truth, unless a single canonical contract is owned end-to-end.

## Product goals vs current stack

| Goal | Local client (achievable) | Network / other users (limited) |
|------|---------------------------|----------------------------------|
| Delete for me | Hide + tombstones on **this device** (best-effort; **not** guaranteed after refresh — see Accepted limitation) | N/A |
| Delete for everyone | Publish command; remove locally when evidence applies | Requires recipient clients + relays honoring the same contract |

## Identified failure modes (historical)

### 1. Deleted DMs reappearing after refresh or during “Account restore” (**DM-001 — accepted limitation**)

**Symptoms:** Batch “delete for me,” refresh, or relay recovery replays identical lines; banner shows restore in progress.

**Investigation status (2026-05-14):** Multiple partial mitigations were landed; **refresh resurrection still reproduces** in maintainer testing. Issue is **closed for patch work** and recorded as **accepted limitation** until architecture refactor (R1) completes.

**Root causes observed in this codebase (foundational, not exhaustive):**

1. **Parallel stores:** IndexedDB message windows, `chatStateStore` persisted DM state, SQLite tombstones (desktop), account **projection event log**, and relay replay each reintroduce rows if not gated by the same suppression keys.
2. **Identity aliasing:** A single logical message may appear under a **local id**, **Nostr event id**, or other aliases. If tombstones or `DM_REMOVED_LOCALLY` only record one id, a replay keyed by another id can re-upsert the row.
3. **Projection path bypass:** `selectProjectionConversationMessages` historically mapped the projection timeline **without** filtering `removedMessageIds` or durable tombstones, so stale rows could still render even when the reducer later learned removals.
4. **Ordering / async gaps:** `appendCanonicalDmRemovedEvent` is async relative to relay bootstrap; durable tombstones must exist **before** replay is applied, or replay must consult them during upsert.

**Mitigations landed (incremental):**

- Durable `suppressMessageDeleteTombstone` for **all** delete identity ids at delete time (not only via bus subscribers).
- Account reducer `upsertMessage` consults `isMessageDeleteSuppressed` so replayed `DM_RECEIVED` cannot resurrect tombstoned ids when storage is hydrated.
- Selector filters `removedMessageIds` and durable tombstones when building UI `Message` lists from projection.

**Required fix (deferred — not incremental):**

- Single canonical “message materialization” boundary (R1) that always checks tombstones, projection removals, and store removals **once**, with explicit identity normalization.
- Restore pipeline contract: never re-import DM timeline rows from backup/chat-state when projection owns history; tombstones loaded before any replay.
- Cross-device: backup must carry tombstones before other devices can converge deletes.

Until then, treat **DM-001** as **documented product behavior**, not an open defect queue item for ad-hoc debugging.

### 2. Community participant list not persisting / collapsing after refresh (**MEM-001 — accepted limitation**)

**Symptoms:** Modal shows two members briefly, then only self (or creator); chat header may show **“1 members”** while messages from other peers still appear; subtitle references projection from membership, invite, and message evidence.

**Investigation status (2026-05-14):** Same class of problem as **DM-001** — multiple code-level “owners” (relay snapshot, roster projection, `memberPubkeys`, known-participant directory, sealed-community CRDT, message-author evidence) racing without a single materialization gate. **Incremental debugging and patch cycles are closed** per maintainer directive.

**Root causes observed (foundational):**

1. **Thin relay snapshots during warm-up** can override richer persisted seeds when confidence rules relax.
2. **Multiple parallel pathways** at the code level (not application-level decentralization) produce conflicting roster truth; UI reads whichever evidence arrived last.

**Maintainer policy:**

- **Do not** schedule further MEM-001 patch/debug work unless **R2** in `docs/program/v1.5.0-architecture-refactor-queue.md` is chartered and completed as a single roster read owner.
- Product copy may note that participant counts can be **incomplete until sync settles**; do not promise a live-accurate roster across refresh without refactor exit criteria.

**Required fix (deferred — not incremental):**

- One roster materialization owner per `(profileId, conversationId)` with monotonic widen + explicit terminal removal only.
- UI reads **only** that projection; relay snapshots are evidence input, not replace authority.

## Is the current database / object model the bottleneck?

**Partially.** The limits are a combination of:

- **Decentralized protocol semantics** (immutability, optional delete handling).
- **Multiple persistence layers** without a single materialization gate (technical debt amplifies protocol rough edges).
- **Async restore + live relay** racing against UI hydration (lifecycle, not only storage choice).

Moving to a different embedded database alone does not remove the need for: explicit identity keys, tombstone-first rendering, and ordered restore. A smaller, explicit **event-sourced projection** with one writer per account profile is the direction most aligned with the constraints above.

## Related code (starting points)

- Delete tombstones: `apps/pwa/app/features/messaging/services/message-delete-tombstone-store.ts`
- Delete UX entry: `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts`
- Conversation hydration: `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- Projection reducer: `apps/pwa/app/features/account-sync/services/account-event-reducer.ts`
- Projection UI selector: `apps/pwa/app/features/account-sync/services/account-projection-selectors.ts`
- Community roster / snapshot policy: `apps/pwa/app/features/groups/providers/group-provider.tsx`, `community-member-snapshot-policy.ts`

## Investigation policy (2026-05-14)

**No further ad-hoc debugging** on **DM-001** or **MEM-001**. Re-open only with an explicit architecture milestone (R1/R2 exit), not as background defect triage.
