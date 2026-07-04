# COM-RUN-02 — Room key restore after device recovery (2026-07)

**Status:** **CANCELLED** — maintainer sign-off 2026-07-03 (room-key restore band abandoned; see [community-membership-redesign-charter-2026-07.md](../../docs/program/community-membership-redesign-charter-2026-07.md))  
**Issue:** COM-RUN-02 · `group-room-key-missing`  
**Canonical owner:** `apps/pwa/app/features/account-sync/services/room-key-restore-repair.ts`  
**Related:** [community-atomic-join-spec](../../docs/archive/program/inactive-2026-06/community-atomic-join-spec-2026-06.md) · [groups-ledger-validation-investigation-2026-07.md](./groups-ledger-validation-investigation-2026-07.md)

---

## Problem

After local profile wipe (EBWebView purge, new device, key re-import), relay backup restores **membership ledger** and chat metadata but **room keys** live in profile-scoped `localStorage`. Users see:

> Membership not fully ready — Room key missing on this device

Chat and invite are blocked (COM-RUN-02) even when coordination directory shows the user as a member.

---

## Production contract (target)

| Trigger | Expected behavior |
|---------|-------------------|
| Encrypted backup restore completes | Re-materialize room keys from backup `roomKeys`, invite DMs, and group-message hints |
| Account sync reaches `private_restored` / phase `ready` | Re-run repair if keys still missing |
| Community home opens with `room_key_missing` | One repair pass from local chat state + ledger |
| Repair succeeds | Publish updated backup (`community_membership_changed`) so **next** device/recovery has `roomKeys` on relay |

**Production does not require Docker.** Docker is **dev-only** for `pnpm dev:relay:docker` (local Nostr relay on `:7000`). Production/desktop release builds use configured relay URLs on the network; coordination may be hosted or local per deployment.

---

## Dev full-stack (testing)

```text
pnpm dev:relay:docker      # optional — local relay :7000 (Docker Desktop required)
pnpm dev:coordination      # :8787 — managed_workspace directory
pnpm dev:desktop -- --online   # rebuild required after code changes
```

`DEV_COORDINATION_ONLY_WORKSPACE=true` **must not** be used for group chat soak — chat/room-key gates are intentionally disabled (COM-RUN-08).

---

## Out of scope (still PAUSED)

- COM-RUN-01 live roster parity across profiles ([membership-graph-integration-study](../../docs/program/membership-graph-integration-study-2026-06.md) §2.1)
- Ledger migration wiring (`migrateLedgerEntries` production caller) — separate slice

---

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | `pnpm -C apps/pwa test:run app/features/account-sync/services/room-key-restore-repair.test.ts` |
| L3 | Desktop: key re-import → NewTest 2 home → banner clears → Enter Community Chat enabled |
| L4 | Two-profile COM-MEM-2 steps 3–4 / 7–8 when maintainer records |

---

## Fallback (operator)

If relay backup has **no** room key evidence (stale backup, creator never published keys):

1. Joiner: accept fresh invite from peer with room key in payload  
2. Creator: re-send invite to self/peer, or restore from portable bundle export taken **after** keys were present locally
