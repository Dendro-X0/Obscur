# Design — Relay restore must not disable relays / lie about contacts (2026-11)

**Parent:** [contacts-empty-after-relay-disable-restore-investigation-2026-11.md](./contacts-empty-after-relay-disable-restore-investigation-2026-11.md)  
**Feedback gate:** A5 honesty · [platform-public-feedback-release-readiness-2026-11.md](./platform-public-feedback-release-readiness-2026-11.md)

```text
HANDOFF ATOMIC STEP: A5 honesty adjacent · restore/relay merge harden
PAUSED / CANCELLED: Soft L3 · Tor · Matrix promote · Continuity
CANONICAL OWNER: account-sync + rehydrate
PROOF: L1 vitest · L2 optional desktop re-check
```

## Invariants

1. Restore / rehydrate merge **never** leaves zero enabled public relays when public boot defaults exist (`reenableWhenNoRelaysEnabled`).
2. For the same relay URL, merge **`enabled = current || incoming`** (local re-enable wins against stale disabled backup rows).
3. Public relay-list rehydrate uses **Kind 10002 only** — Kind 3 is not a relay list source.
4. Manual restore refuses when the pool has **no open** connections; success copy reports **accepted peer count** (and empty-history honesty) after apply.
5. Empty-device Continuity dismiss is **durable** (`localStorage`) so desktop relaunch does not re-nag after Continue empty / successful restore.

## Out of scope (this slice)

- Auto Kind 3 → peerTrust import (separate continuity band).
- Soft L3 / Tor / Matrix promote.

## Proof

| Layer | Command | Result |
|-------|---------|--------|
| L1 | `pnpm exec vitest run app/features/account-sync/services/restore-relay-list-persist.test.ts app/features/account-sync/services/account-sync-manual-intent.test.ts app/features/account-sync/services/account-rehydrate-relay-list.test.ts` (+ mergeRelayList case in encrypted-account-backup-service.test) | **Pass 2026-11-02** — 7+1 targeted |
| L2 | Operator: enable relays → restore → All People non-empty or honest empty message; Relays not all disabled | Open — operator re-check |
