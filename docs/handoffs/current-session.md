# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T03:57:00Z
- Git SHA: uncommitted (STAB-SETTINGS-1 + DM relay quorum + drift native)
- Session Status: **P4-5 DB alignment + DM send UX**

## North star

**[ui-render-loop-systemic-program.md](../program/ui-render-loop-systemic-program.md)** — Band R3 **STAB-SETTINGS-1** (settings shared model + tab error boundaries).

---

## Latest (uncommitted)

### Test 8 / group disappearance (COM persistence)

**Symptom:** Group "Test 8" gone from Network → Groups for both A and B. Banner: *"Leave confirmations pending on relay … N relay declined. Local leave is already recorded."*

**Not a SQLite list-authority bug.** Groups tab reads `createdGroups` from `group-provider`; visibility is gated by **membership ledger + leave outbox + tombstones** (REL-001), not missing SQLite rows.

**Root cause (most likely):**
1. Explicit **local leave** ran on at least one profile (`leaveGroup` / `removeGroupConversation` → ledger `left` + leave outbox + tombstone).
2. Leave page applies local exit **before** relay confirm (`groups/leave/page.tsx` → `applyLocalLeave()` first).
3. Relay leave/disband publish **failed** → outbox stays `rejected` → banner ("relay declined"). Relay failure does **not** restore membership.
4. **Auto-disband cascade:** when leaver's live CRDT roster showed no other members, `use-sealed-community` attempted disband → `dispatchGroupRemove` on recipient → both profiles can lose the group locally even when relay never confirmed.

**Fix (uncommitted):** `community-auto-disband-policy.ts` — auto-disband uses seeded roster (`initialMembers` / directory / persisted `memberPubkeys`) in addition to live CRDT members, so a stale relay roster cannot disband when local join evidence still lists another member.

**Recovery for Test 8:** Local terminal state must be cleared or overridden — fresh invite + `addGroup(..., { allowRevive: true })`, or manual purge of leave outbox (`obscur.group.leave_outbox.v1.*`), membership ledger `left` entry, and group tombstone for that `groupId@@relayUrl`.

### DM relay false warning (1/2 relays)

**Problem:** Toast *"Relay confirmation was partial (1/2)…"* on every send despite A↔B delivery.

**Root cause:** `buildSendConfirmation` required `successCount >= 2` for `sent_quorum`; transport `MIN_QUORUM` is 1. Confirmed publish → `sent_partial` → warning toast in `dm-controller`.

**Fix:** Align confirmation with transport quorum (`sent_quorum` when publish succeeded); remove redundant quorum toast branch. Test: partial redundancy 1/2 → `sent_quorum`.

### Native drift detector (P4-5)

**Problem:** Drift report compared chat-state message counts vs projection on native; chat-state mirror intentionally strips DM bodies (SQLite authority) → perpetual message drift.

**Fix:** Skip message-domain delta when `requiresSqlitePersistence()`. Test added.

---

## STAB-SETTINGS-1 (uncommitted) — stop settings whack-a-mole

**Problem:** Each settings tab had an isolated model (`Record<string, unknown>`). Panels copied the monolithic `_settings-original.tsx` destructuring list; tabs crashed when a field existed on Relays but not Storage (and vice versa).

**Fix (composition, not per-tab patches):**

1. **`useSettingsSharedModel`** — single owner for `relayRuntimeStatus`, `deriveRelayRuntimeStatus`, `deriveRelayNodeStatus`.
2. **`createSettingsTabPanelModelProvider`** — merges `{ ...shared, ...tab }` for every tab automatically.
3. **`SettingsTabPanelErrorBoundary`** — tab crash stays in-tab; root app keeps running.
4. **CI:** `settings-tab-panel-mount.stability.test.tsx` mounts all 10 tab providers; `pnpm verify:stability` **Pass**.

Also: STAB-P1 profile `revert()` loop fix; STAB-P2 storage relay field (superseded by shared model).

---

## Next atomic step

1. Rebuild desktop; recreate "Test 8" or recover via fresh invite after clearing terminal leave state.
2. Verify leave on creator profile when member B is in directory/roster — group must **not** auto-disband for B.
3. Commit auto-disband band + DM relay/drift fixes when ready.
