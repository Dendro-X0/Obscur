# P5 — Persistence survival contract (architecture rewrite)

**Status:** Complete (2026-06-02) · **Replaces manual smoke for persistence claims**  
**Parent:** [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) · [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md)  
**Trigger:** Groups and DM history disappear without user delete — local debugging cannot prove survival; only **module contracts + CI** count.

---

## Problem statement (user-visible)

| Symptom | User interpretation | Architectural truth |
|---------|---------------------|---------------------|
| Group vanishes (e.g. Test 8) | "App cannot persist groups" | **Terminal local leave intent** (ledger `left` + outbox + tombstone) hides group; SQLite row may still exist. Relay decline does not restore. |
| DM history gone after ~7 days | "7-day retention deletes chat" | **No default 7-day local purge** (`localMessageRetentionDays` default **0** = unlimited). Loss happens when **SQLite never owned the thread** and relay live window (`DM_SUBSCRIBE_HISTORY_LOOKBACK_SECONDS = 7d`) is the only recovery path — or terminal leave / drift paths apply. |
| Manual re-test useless | Correct | Multiple owners, terminal mutations without recovery owner, and relay-window confusion — patches without subtraction do not hold. |

---

## Rewrite principle

**One durable owner per domain. Survival = automated contract test, not maintainer memory.**

Manual matrix rows (Phase B) are **deferred** for persistence until P5 bands land. Gates:

```bash
pnpm verify:p5-persistence   # (to add) — survival contracts only
pnpm verify:stability        # existing render-loop / settings gates
```

---

## Bands (module-level)

| Band | Owner module(s) | Deliverable | CI gate |
|------|-----------------|-------------|---------|
| **P5-DM-1** | `message-persistence-service.ts` → SQLite | Every accepted DM write lands in `db_insert_message` before UI success | `message-persistence-service.test.ts` (exists) + **`dm-sqlite-history-survival.test.ts`** |
| **P5-DM-2** | `dm-conversation-hydrate-indexed-scan.ts` | Hydrate reads SQLite **without age ceiling**; retention filter is **opt-in** privacy setting only | Survival test: message **8+ days** old still in window |
| **P5-DM-3** | `dm-relay-transport.ts` | Document: 7d `since` is **live subscription only**, never history authority | Grep gate: no hydrate path imports lookback constant |
| **P5-COM-1** | `community-membership-mutation-owner.ts` | Leave write path single owner | `community-leave-path-audit.test.ts` (exists) |
| **P5-COM-2** | **`community-leave-recovery.ts`** (new) | **Recovery owner** — revoke terminal leave when relay rejected + sqlite/chat-state row exists | `community-leave-recovery.test.ts` |
| **P5-COM-3** | `community-auto-disband-policy.ts` | Auto-disband requires seeded roster evidence | `community-auto-disband-policy.test.ts` (exists @ `1ec2e385`) |
| **P5-COM-4** | `community-group-sqlite-store.ts` | List upsert on create/update | `community-group-sqlite-store.test.ts` (@ `4f776559`) |
| **P5-BKP-1** | `encrypted-account-backup-service.ts` | Native restore must not dual-write DM bodies into chat-state authority | `encrypted-account-backup-service.native-restore.test.ts` + authority gate |

---

## Subtraction queue (stop the bleeding)

1. **Do not** treat leave outbox `rejected` as permanent hide without recovery affordance — outbox tracks relay publish, not membership truth.
2. **Do not** use relay 7d lookback as implicit history TTL — SQLite is native authority ([policy § Owner matrix](./obscur-native-sqlite-policy.md)).
3. **Remove** parallel hide paths: `leaveGroup` UI removal + ledger + outbox + tombstone without symmetric `revokeCommunityLeaveTerminalState`.
4. **Subtract** backup/chat-state DM body merge on native restore (P4-5 queue item 3).

---

## Recovery (Test 8 and similar)

Programmatic path (no DevTools):

1. `revokeCommunityLeaveTerminalState({ publicKeyHex, groupId, relayUrl, profileId })`
2. Re-hydrate groups from SQLite + chat-state (`group-provider` hydrate)
3. If sqlite row missing, require **fresh invite** — no magic resurrection

UI: summary banner gains **Restore communities** when `rejectedCount > 0` (P5-COM-2).

---

## Exit (2026-06-02)

All P5 bands gated via `pnpm verify:p5-persistence` (**64 tests**, 5 skipped @ `ab465e40`). Post-P5 ancillary complete: **ACC-03** relay checkpoint sqlite owner; **ACC-04** call records write + DM invite card read merge.
