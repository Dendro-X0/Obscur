# Investigation — groups-ledger-validation (RIW-1)

**Status:** L3 pass recorded (2026-07-03)  
**Date:** 2026-07-02 (UTC) · repair fix + L3 verify 2026-07-03  
**Symptom:** `groups-ledger-validation` · register `verify:issue:agent:0c914a5d3cb0912d`  
**Tracker:** [`docs/program/obscur-runtime-issue-tracker-2026-07.md`](../../docs/program/obscur-runtime-issue-tracker-2026-07.md) §Step 1  
**Canonical owner:** `apps/pwa/app/features/groups/services/community-membership-ledger.ts`

---

## Summary

Tester1 profile loads **20 ledger entries** on unlock; **18 fail validation** on every load. Console emits `groups.ledger_migration_needed` (9 entries) and `groups.ledger_validation_issues` repeatedly, but **`invalidEntries` never decreases** across rounds 1–21.

**Primary finding:** `migrateLedgerEntries()` exists and is unit-tested, but is **never invoked** from the production ledger load path — only logged as “actual migration happens async via migrateLedgerEntries” with no caller.

**Secondary finding:** Validator v2 rejects `status: "historical"` (and `invited`, `unknown`) while ledger merge/dedupe explicitly preserves historical rows — structural mismatch, not transient corruption only.

---

## Evidence (round 21 baseline)

| Signal | Value | Capture |
|--------|-------|---------|
| `invalidEntries` / `totalEntries` | 18 / 20 | `cap-7936d41d27cd/console.jsonl` |
| `needsMigrationCount` | 9 | same |
| NewTest 2 `groupId` | `b93f53e23d8c4456835afd3f4d3a627b` | sampleErrors in digest |
| Sample errors | missing `publicKeyHex`; missing `memberPubkeys` | `fault-5e069e8a` |
| `[CommunityLedger] fromGroup` | missing `publicKeyHex`; invalid status `"historical"` | Info page console |
| Membership health (Info nav) | flips `room_key_missing,coordination_missing_peer` → `ready:1` | cascade gate timing |

**Profiles:**

| Profile | Suffix | Entries (approx) | Invalid (approx) |
|---------|--------|------------------|------------------|
| Tester1 `default` | `c191ea56` | 20 | 18 |
| Tester2 `profile-2` | `d946830f` | 3 | 2 |

---

## Code path analysis

### Load path (read-only, every unlock)

```
readCommunityMembershipLedger()
  → merge scoped + legacy localStorage
  → needsMigration(e) count → log groups.ledger_migration_needed
  → validateLedgerEntries(merged, { allowLegacy: true })
  → log groups.ledger_validation_issues if invalid > 0
  → return mergedEntries (unmodified)
```

File: `community-membership-ledger.ts` ~L367–397.

**Gap:** Comment says migration runs async; **no `migrateLedgerEntries()` call** anywhere in app code outside tests.

### Validator vs ledger semantics

`community-ledger-validator.ts`:

- Requires `publicKeyHex`, `displayName`, `memberPubkeys`, `adminPubkeys`
- Allows status: `joined | left | expelled | pending` only
- Rejects `historical`, `invited`, `unknown`

`community-membership-ledger.ts` dedupe:

- Explicit precedence: non-`historical` beats `historical` (M2 user-intent rule)
- Implies **`historical` rows are intentional** in storage

**Hypothesis:** Validation rules target v2 “joined” entries; persisted fixture contains v1 + historical reconstruction rows that can never pass strict validation without migration or archive policy.

### Migration module (exists, unused)

`community-ledger-migration.ts` — v1→v2 adds `publicKeyHex`, member lists from `persistedGroups`, timestamps.

**Blocker for auto-migration today:** `persistedGroups` context must be supplied; load path does not gather chat-state groups before calling migrate.

---

## Sample group ID map (Tester1)

| groupId (prefix) | Likely fixture | Validation failure class |
|------------------|----------------|-------------------------|
| `b93f53e23d8c4456835afd3f4d3a627b` | **NewTest 2** (active COM-MEM) | missing `publicKeyHex` |
| `6d5e4723ad1946869e91c6fe8e3b45c9` | legacy community | missing `publicKeyHex` |
| `f83e544943bc44df9e1043314d8cfdbf` | legacy community | missing `memberPubkeys` |

Full inventory requires post-purge clean recreate or maintainer localStorage export — see purge procedure below.

---

## Downstream impact (confirmed in capture)

| Symptom | Link to ledger |
|---------|----------------|
| COM-RUN-01 roster divergence | `knownParticipantCount=0` on NewTest 2; join evidence thin |
| group-room-key-missing sidebar | `LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE` path; ledger invalid + room-key store split |
| COM-RUN-11 blocked | Historical invite cards in DM; no fresh `invited` ledger row |
| O-4 send works intermittently | Health cascade can reach `ready:1` despite sidebar placeholder |

Ledger invalidity is **not** sole root cause of COM-RUN-01/11 but **amplifies** roster/invite repair failures.

---

## Repro (L3 — desktop MCP)

1. Full stack: `:8787` + `:7000` + desktop CDP `:9230`
2. Unlock Tester1 → any navigation triggers ledger load
3. Filter console: `groups.ledger_validation_issues`
4. `client_runtime_digest_pull` → expect `symptomIds: ["groups-ledger-validation"]`

**Pass criterion for fix band:** After controlled repair, `invalidEntries` → 0 (or documented exempt count for archived `historical` only).

**L3 pass (2026-07-03):** Tester1 unlock on rebuilt static shell · session `csess-2527774254b5` · `groups.membership_ledger_load` reports `scopedEntryCount:7`, `invalidEntries:0` · digest `symptomIds: []` (no `groups-ledger-validation`). Fix: slices **B + C** — `repairIncompleteJoinedLedgerEntriesOnLoad` + `ARCHIVAL_LEDGER_STATUSES` validator split.

---

## Remediation options (design — no code in this spec)

| Option | Description | Proof |
|--------|-------------|-------|
| **A — Fixture purge (maintainer)** | `pnpm purge:workspace --match NewTest` both profiles; recreate NewTest 2 + fresh invite | Post-purge unlock: invalid ≤ 1 |
| **B — Wire migration on load** | Call `migrateLedgerEntries` after read with `persistedGroups` from chat state; persist if changed | Unit + MCP: `needsMigrationCount` → 0 |
| **C — Validation policy split** | Validate `joined` rows strictly; `historical` → archive bucket excluded from invalid count | Validator tests + digest clean |
| **D — One-shot repair script** | Dev-only script: export ledger JSON, apply v1→v2, write back | Maintainer sign-off on Tester1/2 |

**Recommendation:** **A first** (unblocks COM-RUN-11 fixture); then **B + C** as product fix — migration must run or validation must not treat archival rows as errors.

---

## Proof plan (when implementing)

| Layer | Command / action |
|-------|------------------|
| L1 | `community-ledger-validator.test.ts`, `community-ledger-migration.test.ts` |
| L2 | Ledger load integration test with fixture v1 snapshot |
| L3 | MCP unlock → digest `invalidEntries: 0` |
| L4 | Dual-profile COM-MEM-2 invite after purge |

---

## CodaCtrl capture notes

- Auto-map `groups.ledger_validation_issues` → `groups-ledger-validation` (shipped RIW-8)
- Add scenario step: post-unlock digest assert `invalidEntries === 0` after purge baseline
- Chain node hypothesis should cite **missing migrate invocation**, not “migration slow”

---

## References

- `apps/pwa/app/features/groups/services/community-membership-ledger.ts`
- `apps/pwa/app/features/groups/services/community-ledger-validator.ts`
- `apps/pwa/app/features/groups/services/community-ledger-migration.ts`
- [`docs/program/com-run-11-fixture-setup-2026-07.md`](../../docs/program/com-run-11-fixture-setup-2026-07.md)
