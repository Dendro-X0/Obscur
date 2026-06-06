# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T22:40:00Z
- Git SHA: (uncommitted — Band B0 gate work)
- Session Status: **Path B signed · Band B2 wire honesty landed (tests) · ready for B3**

## North star

1. **[community-fork-decision-2026-05.md](../program/community-fork-decision-2026-05.md)** — **Path B — Internal network** (signed 2026-06-02).
2. **[back-online-modular-roadmap-2026-06.md](../program/back-online-modular-roadmap-2026-06.md)** — ordered bands B0–B5 (subtraction before addition).
3. **[obscur-native-sqlite-policy.md](../program/obscur-native-sqlite-policy.md)** — native SQLite owner matrix; DM claims: `pnpm verify:p5-persistence` (**64 tests**).

---

## Diagnosis (user-confirmed)

- **Groups (Test 8):** Terminal **local leave intent** hides communities — not missing SQLite create. Banner *relay declined* = publish failed after local exit; does not restore.
- **DM ~7 days:** Default retention is **unlimited** (`localMessageRetentionDays: 0`). Loss when SQLite never owned the thread and relay live window (7d `since`) was the only path — **not** a built-in 7-day delete policy.

---

## Landed @ `1ec2e385` / `4f776559` / `ac682c11`

STAB settings, DM quorum, native drift skip, auto-disband seeded roster, native group list sync on add/update.

---

## P5

| Band | Module | Gate |
|------|--------|------|
| P5-DM-2 | `dm-conversation-hydrate-indexed-scan` | 8-day-old SQLite row survives hydrate test |
| P5-COM-2 | `community-leave-recovery.ts` | Revoke rejected leave → ledger `joined`, clear outbox/tombstone |
| P5-COM-2 UX | *(removed)* leave outbox summary banner | Terminal rejected rows pruned; Groups tab stays clean |
| P5-BKP-1 | `encrypted-account-backup-service` native restore | Strip bodies before chat-state replace; skip hydrateMessages |
| P5-DM-1 | `message-persistence-service.test.ts` | SQLite write on confirmed eventId |
| P5-DM-3 | `p5-persistence-authority-gates.test.ts` | 7d lookback only in `dm-relay-transport.ts` |
| P5-COM-3/4 | auto-disband + sqlite sync | existing tests |
| Script | `pnpm verify:p5-persistence` | **64 tests pass** |

---

## Native ancillary SQLite (ACC-03/04)

| Band | Module | Behavior |
|------|--------|----------|
| ACC-03 | `relay-checkpoint-sqlite-store.ts` | Mirror `dm:all` → per-relay SQLite on sync + restore |
| ACC-04 | `call-record-sqlite-store.ts` | Terminal calls → `call_records`; DM invite cards merge sqlite summaries |

---

## CI evidence (2026-06-02)

| Gate | Result |
|------|--------|
| `pnpm verify:p5-persistence` | **64 passed**, 5 skipped |
| `pnpm verify:stability` | **green** (phase1–3, react stability, gateway/transport boundaries) |

---

## Band B0 (landed)

| Deliverable | Evidence |
|-------------|----------|
| Production-strict coordination gate (`probedHealthy === true`; no assume-local / coordination-only in prod) | `community-dev-flags.ts` — `isPathBWorkspaceDevEscapeAllowed` |
| Create dialog passes raw probe to trust assessment; no coordination-only bypass of `public_relay_blocked` | `create-group-dialog.tsx` |
| K-M1/K-M2 local matrix docs | `apps/coordination/README.md`, `apps/pwa/.env.example` |
| CI gate | `pnpm verify:path-b-b0` — **23 passed** |

## Band B1 (landed)

| Deliverable | Evidence |
|-------------|----------|
| Hybrid roster widen disabled (`mergeHybridMembershipTruthFallback` no-op; R1 policy + invite blocklist coordination-only) | `community-membership-truth.ts`, `community-workspace-r1-policy.ts`, `community-invite-eligibility-read-model.ts` |
| Relay ingest chat-only for `managed_workspace` | `use-sealed-community.ts` — skips `relay_join` / `relay_leave` / `roster_seed` when coordination authority |
| Single `useSealedCommunity` instance policy documented | `main-shell.tsx`, `group-home-page-client.tsx` |
| Worker steward ACL (bootstrap steward expel; self-attested join/leave) | `apps/coordination/src/membership-delta-acl.ts` |
| CI gate | `pnpm verify:path-b-membership` — **23 passed** (12 worker + 11 PWA) |

## Band B2 (landed)

| Deliverable | Evidence |
|-------------|----------|
| Team relay transport publishes real `["EVENT", …]` via `publishToUrl`; fails without signer or relay rejection | `community-team-relay-transport.ts`, `community-team-relay-wire.ts` |
| Invite manager reads v2 relay list (aligned with `use-relay-list`) | `relay-list-enabled-urls.ts` → `invite-manager.ts` |
| Group management kind-0 REQ scoped to dialog lifecycle | `use-community-member-display-names.ts` |
| CI gate | `pnpm verify:path-b-b2` — **8 passed** |

## Next atomic step

**Band B3** ([back-online-modular-roadmap-2026-06.md](../program/back-online-modular-roadmap-2026-06.md)):

1. Manual K-M1/K-M2 run (two profiles + coordination dev) — record pass/fail in handoff.
2. P5-COM-MSG gate design: one group message send path + cold-restart hydrate.

**Do not** piecemeal patch Test 10 without P5-COM-MSG gate design.

Exploration shelf (research-only, complete): [exploration/README.md](../exploration/README.md).
