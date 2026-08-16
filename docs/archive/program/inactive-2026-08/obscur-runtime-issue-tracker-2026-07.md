# Obscur runtime issue tracker — verification pass (2026-07)

**Status:** Active — capture and verify; implementation only after investigation spec per row  
**Last updated:** 2026-07-04 (UTC) — repair queue **complete** (R1–R3 + R5 **VERIFIED t4** · R4 **A**)  
**Audience:** Maintainer + CodaCtrl Studio / MCP operators  
**Charter:** [runtime-issue-investigation-workflows-2026-06.md](./runtime-issue-investigation-workflows-2026-06.md) · [codactrl-improvement-findings-2026-07.md](./codactrl-improvement-findings-2026-07.md)  
**Machine register:** `.codectx/verify/issues-register.json` (**15 triage rows** / 14 symptoms + unmapped bucket as of round10)  
**Agent boot:** `.codactrl/verify/issue-report/report-rollup.md` · `report-lite.json` · `.codectx/verify/issues-register.summary.json`

---

## Purpose

Consolidate **all known Obscur client runtime issues** into one verification queue. Work **one row at a time**: reproduce → capture with CodaCtrl → document → file or update issue → note CodaCtrl improvement for parallel work in `E:\Experimental projects\codactrl`.

**Two toolsets:**

| Tool | Use for |
|------|---------|
| **CodaCtrl Studio** (Verify lane) | Scenario catalog, issues register UI, run history, false-green scan |
| **CodaCtrl MCP** (`client_*`, `verify_*`) | Live CDP attach, digest pull, console, screenshots, `client_issue_create` |

**Deferred band:** Mobile performance on 4GB RAM — track under [MOB-1](#mob-1--mobile-low-memory-performance) after desktop core chain rows.

---

## Maintainer repair queue (2026-07-04)

Active band — see [current-session.md](../handoffs/current-session.md).

| ID | Symptom | Status |
|----|---------|--------|
| **R1** | `group-room-key-missing` — health chrome vs send | **VERIFIED t4** — `2026-07-04-r1-room-key-health-t4` · chain `chain-r1-room-key-health-2026-07-04` |
| **R2** | `auth-keychain-restore-failed` — cold password unlock | **VERIFIED t4** — `1ab19204` |
| **R3** | Sidebar preview stale | **VERIFIED t4** — `3cf79dbe` · `csess-264849283e3c` |
| **R5** | O-4 ingest chrome | **VERIFIED t4** — `60c9bb3c` · `csess-58ce611e907b` / `csess-b7f42e294e5e` |

**Repair band:** R1 health hook · R2 unlock-time identity · R3 sidebar SQLite hydrate · R5 ingest room-key owner — all **VERIFIED t4**. R4 COM-RUN-01 roster **A** @ ACC-02. Maintainer gate: band EXIT → Phase 4 deploy.

---

## Verification protocol (every row)

### Stack preflight

```bash
# Terminal A — coordination (community / membership deltas)
pnpm dev:coordination

# Terminal B — Obscur desktop with MCP CDP
export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9230"
pnpm dev:desktop -- --online --skip-build

# Terminal C — CodaCtrl daemon (from Obscur repo root)
CLIENT_CAPTURE_MODE=playwright codactrld serve
# Health: http://127.0.0.1:46231/health → repoRoot must match `obscur` workspace path
```

### Capture sequence (MCP golden path)

1. `client_dev_environment_get` → `workspaceAligned: true`
2. `client_session_connect` `{ "cdpPort": 9230 }` (or `windowLabel: "profile-picker"` when on picker)
3. Reproduce via `client_interact_click` (not `client_navigate` on SPA routes)
4. `client_runtime_digest_pull` **before** cold restart if applicable
5. `client_screenshot_capture` + `client_console_latest`
6. `client_issue_create` or update existing row with new `evidenceRefs`
7. Studio Verify lane: import fault / review register

### Row exit criteria

| Field | Required |
|-------|----------|
| Repro steps | Numbered, fixture noted (Tester1 / NewTest 2 / cold restart) |
| Proof tier | t2 (static/log) · t3 (live CDP) · t4 (cold restart / multi-window) |
| Evidence paths | Under `.codectx/verify/` |
| `doesNotProve` | Explicit non-coverage |
| Obscur suggestion | Investigation spec candidate or owner subtraction |
| CodaCtrl suggestion | Tool gap or shipped primitive to reuse |

---

## Issue inventory by domain

### A — Community & member relationships

| Queue | ID | Symptom / title | Severity | Capture status | Verify status | Primary owner |
|-------|-----|-----------------|----------|----------------|---------------|---------------|
| 1 | **RIW-1** / `0c914a5d3cb0912d` | 18/20 membership ledger invalid; migration does not clear band | p1 | Captured 2026-07-01 | **Fix landed (L1)** — migration + thin validation + joined field repair; **L3 partial** round23 | `community-membership-ledger.ts` |
| 4 | **RIW-4** / `fe1556fff6a7792e` | Coordination membership/deltas unreachable (8787) | p2 | Captured | **Confirmed** (see §Step 4) | coordination client |
| — | **COM-RUN-01** | Participant roster diverges between profiles | p0 | Product register | **Confirmed** Tester1 only (see §Step 5) | roster read owner |
| — | **COM-RUN-02** | Room key missing on joiner | p0 | Product register | **CANCELLED** — maintainer 2026-07-03; redesign [charter](./community-membership-redesign-charter-2026-07.md) | ~~atomic join~~ |
| — | **COM-RUN-05** | Partial join: member UI without atomic contract | p1 | Product register | **Not re-verified** | atomic join |
| — | **COM-RUN-06** | Late failure detection (days after “OK”) | p1 | Maps RIW-1 | Partial | membership health |
| — | **COM-RUN-07** / ACC-02 | Six+ membership/roster owners | p1 | Maps RIW-1/2 | Partial | architecture |
| — | **COM-RUN-11** | Invite UX: both profiles see Cancel | p0 | Product register | **Blocked** t4 (see §Step 5) | invite role ecosystem |

**Fixture:** NewTest 2 · `ws://localhost:7000` · coordination :8787 · purge before clean retest per [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md).

---

### B — Database & projection authority

| Queue | ID | Symptom / title | Severity | Capture status | Verify status | Primary owner |
|-------|-----|-----------------|----------|----------------|---------------|---------------|
| 2 | **RIW-2** / `7a3d72a85a8e1c35` | Projection authority oscillation; projection/sqlite count split | p2 | Captured | **Verified** (2026-07-01 live, refined) | `account-projection-runtime.ts` |
| — | ACC-03 | Relay checkpoints SQLite | — | **Resolved** | Closed | `relay-checkpoint-sqlite-store.ts` |
| — | ACC-04 | Voice call records SQLite | — | **Resolved** | Closed | `call-record-sqlite-store.ts` |

**Key metric:** `projectionConversationCount` vs `sqliteConversationCount` at unlock + 30s + post-EOSE.

---

### C — DM & group chat history / retention

| Queue | ID | Symptom / title | Severity | Capture status | Verify status | Primary owner |
|-------|-----|-----------------|----------|----------------|---------------|---------------|
| 3 | **RIW-3** / `df96c6996e0512a9` | DM normalize direction mismatch (36 events → 6 msgs) | p2 | Captured | **Confirmed** (see §Step 3) | `dm-conversation-normalize-message.ts` |
| — | **O-2** | Outgoing DM vanishes after cold restart | p0 | Case study | **Partial** (see §Step 6) | persistence + `message_updated` bridge |
| — | **O-4** | Group thread messages never appear from relay | p0 | Case study | **Partial** (see §Step 7) | group ingest wiring |
| — | ACC-01 | Delete-for-me not durable across refresh | accepted | Doc | **Not re-verified** | deletion roster |

**Cold-restart proof (O-2):** send DM → digest pull → kill `obscur_desktop_app.exe` → restart → hydrate → assert message visible. Proof tier **t4**.

---

### D — Transport & dev infrastructure

| Queue | ID | Symptom / title | Severity | Capture status | Verify status | Primary owner |
|-------|-----|-----------------|----------|----------------|---------------|---------------|
| 5 | **RIW-5** / `fd6bb614119ce9f2` | Partial relay stack (7000, relay.internal down) | p3 | Captured | Pending | transport engine |
| — | **O-3** | Relay offline flash on every refresh | p1 | Case study | **Not re-verified** | relay warmup policy |
| — | **O-1** | DM notification storm | p1 | Case study | **Not re-verified** | notification coalesce |

---

### E — CodaCtrl / verification tooling

| Queue | ID | Symptom / title | Severity | Capture status | Verify status | Owner |
|-------|-----|-----------------|----------|----------------|---------------|-------|
| — | **RIW-6** / scenario row | Profile-picker scenario false-red (9222/3341) | p1 | Captured | CodaCtrl fix | verify script |
| — | **RIW-7** / `ea000f3b3f41603b` | Multi-window single CDP target | p2 | Captured | Documented | Tauri / MCP |
| — | assert `5ad02d69dd30` | Tester2 not visible (warm session) | p1 | Captured | Harness | MCP assert |
| — | **RIW-8** | Runtime issue export product | design | Designed | N/A | Obscur + CodaCtrl |

---

### F — Mobile (deferred)

#### MOB-1 — Mobile low-memory performance

| Field | Value |
|-------|-------|
| Target | Smooth operation on **4GB RAM** devices |
| Status | **Deferred** until desktop queue rows 1–3 verified |
| CodaCtrl | Perf lane monorepo audit + future mobile provider spike (`codactrl/docs/studio/evidence/ve4f-mobile-provider-spike.md` — external repo) |
| Obscur | Android SQLite policy; compact layout band |

---

## Verification queue (execution order)

Work top to bottom. Do not skip ahead on p1 product rows without noting dependency.

| Step | Row | Action | Stack required | Depends on |
|------|-----|--------|----------------|------------|
| **1** | RIW-1 | Re-verify ledger on Tester1 unlock; optional purge retest | Desktop | — | **Done** — see tracker §Step 1 |
| **2** | RIW-2 | Re-attach digest; confirm projection vs sqlite counts | Desktop | 1 context | **Done** — see tracker §Step 2 |
| **3** | RIW-3 | Open Tester2 thread; count normalize mismatches | Desktop | 2 | **Done** — see tracker §Step 3 |
| **4** | RIW-4 | Re-run with coordination up; compare browser vs curl CORS | Full stack | — | **Done** — see tracker §Step 4 |
| **5** | COM-RUN-01 + 11 | Two-window NewTest 2 roster + invite UX | Full stack + 2 profiles | 1, 4 | **Partial** — see §Step 5 |
| **6** | O-2 | Cold-restart DM retention | Desktop t4 | 2 stable | **Verified t4** (password unlock) — see §Step 6 round2 |
| **6b** | **RIW-9** | DM temporal UI chain (`dm-ui-split-brain`) | Desktop t3 + chain | 2, 6 | **Partial** — warm + reopen stable; cold split-brain not repro; see §RIW-9 |
| **7** | O-4 + COM-RUN-02 | Group thread relay round-trip | Full stack | 4, 5 | **Partial t4** — send verified ×3 (round6–8); COM-RUN-02 investigation spec filed (round9) |
| **8** | RIW-5, O-3, O-1 | Transport / relay UX soak | Desktop or full | — | **Done** — see §Step 8 |
| **9** | MOB-1 | Perf audit on Android target | Mobile | Desktop chain | **Next** |

---

## Row detail — verification worksheets

### Step 1 — RIW-1 (membership ledger)

**Issue:** `verify:issue:agent:0c914a5d3cb0912d` · `symptomId: groups-ledger-validation`

| Check | Method | Pass criterion |
|-------|--------|----------------|
| Ledger load | `client_runtime_digest_pull` | `invalidEntries` / `totalEntries` recorded |
| Migration stall | Console filter `ledger_migration` | Count decreases OR documented stall |
| CommunityLedger reject | Console `CommunityLedger` | Sample error IDs listed |
| Purge retest | `purge-workspace-communities.mjs` + re-unlock | Invalid count drops to 0 OR fixture corruption confirmed |

**Obscur suggestion (if confirmed):** Investigation spec — `migrateLedgerEntries` completion vs controlled fixture purge; map sample group IDs to NewTest 2 history.

**Investigation spec (2026-07-02):** [`specs/backend/groups-ledger-validation-investigation-2026-07.md`](../../specs/backend/groups-ledger-validation-investigation-2026-07.md) — **confirmed:** `migrateLedgerEntries()` never called on load; validator rejects `historical` status that dedupe preserves.

**Implementation (2026-07-03, uncommitted):** Option **B + C** from spec — `applyLedgerVersionMigrationOnLoad` persists v1→v2 on read; `isArchivalLedgerStatus` exempts `historical`/`invited`/`unknown` from strict invalid count when `allowLegacy`. L1: `community-membership-ledger.test.ts` + validator tests pass. L3: rebuild desktop (`pnpm dev:desktop -- --online`, no `--skip-build`) then MCP digest on Tester1 unlock.

**COM-RUN-11 fixture charter:** [`docs/program/com-run-11-fixture-setup-2026-07.md`](./com-run-11-fixture-setup-2026-07.md)

**CodaCtrl suggestion:** Auto-map `groups.ledger_validation_issues` on digest import (RIW-8 table); Studio register column for `symptomId`.

**Prior evidence:** `csess-f2191e90e578` · `fault-6a3f1d6c`

### Step 1 re-verification (2026-07-03 — round23 CodaCtrl t3, pre-rebuild shell)

| Field | Value |
|-------|--------|
| Session | `csess-aa3a9eab9c36` |
| Stack | Full stack `:8787` + `:7000` + CDP `:9230` + codactrld `:48231` |
| Profile | Tester1 warm unlock |
| **invalidEntries / totalEntries** | **7 / 7** (latest `groups.membership_ledger_load`; down from historical 18/20) |
| **needsMigrationCount** | **0** (entries already v2-labelled or no version gap detected) |
| Digest signals | `groups-ledger-validation` still mapped; historical event count 18 in rolling window |
| **Functional (working)** | DMs hydrated (Tester2 thread, O2-coldrestart visible); NewTest 2 listed in Group sidebar |
| **COM-RUN-11** | **Blocked** — only superseded/canceled invite cards in Tester2 DM |
| Chain node | `n9-round23-warm-baseline` on `chain-o4-group-ingest-2026-07-02` |
| Register | `verify:issue:agent:56d6ef6f5831f080` (RIW-1) · `verify:issue:agent:1591f00d1d6bb8eb` (COM-RUN-11) |
| **Verdict** | **Pre-fix baseline captured** — RIW-1 code landed but shell rebuild blocked on TS errors (fixed same session) |

**Evidence:** `.codectx/verify/client-sessions/csess-aa3a9eab9c36/captures/cap-cfae3752ba87/digest.json` · `fault-4ae5509f.json`

### Step 1 re-verification (2026-07-03 — round23 post-rebuild, second shell pending)

| Field | Value |
|-------|--------|
| Session | `csess-a2718d3b966a` |
| Unlock | `obscurDevLab.unlock('tester1')` after cold restart to `/profiles` |
| **invalidEntries / totalEntries** | **7 / 7** (first rebuild — incomplete v2 rows) |
| Root cause | 6× `left` rows missing `memberPubkeys`; 1× `joined` NewTest 2 missing `publicKeyHex`; `needsMigrationCount: 0` skips v1 migration |
| **Follow-up code** | Thin validation for `left`/`expelled`; `ledger_field_repair_applied` for joined rows; raw read path for persist (no save side-effects) |
| Chain | `n10-round23-post-rebuild-ledger` ← `n9-round23-warm-baseline` |
| **Verdict** | **L3 partial** — needs one more rebuild to prove `invalidEntries → 0` |

---

| Field | Value |
|-------|--------|
| Session | `csess-56331621b1d9` |
| Stack | Desktop `:1430` + CDP `:9230` + coordination `:8787` up |
| Repro | Manage Profiles → `/profiles` → click Tester1 (native session auto-unlock, no password) |
| **invalidEntries / totalEntries** | **18 / 20** (unchanged vs 2026-07-01 prior + 2026-06-30) |
| **needsMigrationCount** | **9** (unchanged) |
| Migration completed? | **No** — `ledger_migration_needed` logged 48× in digest; count never drops |
| sampleErrors | Same three groups: `b93f53e2…` missing `publicKeyHex`; `6d5e4723…` missing `publicKeyHex`; `f83e5449…` CRITICAL missing `memberPubkeys` |
| Ledger load trigger | Fires on **profile navigation** (`cap-c4a8209553e9` @ 06:17:11), not only cold unlock |
| **New co-symptom** | `dm_kernel.sqlite_write_failed` ×12 in same window (digest `fault-c957c88f`) — database write failures during profile switch |
| UI side-effect | Tester2 thread renders **empty** (“start of encrypted conversation”) after profile click despite sqlite history — note for Step 6 (O-2) / history band |
| Digest import | `fault-c957c88f` — **`symptomIds: []`** (CodaCtrl auto-map still missing) |
| **Verdict** | **CONFIRMED p1** — persistent fixture corruption + migration stall; not transient |

**Evidence paths (this pass):**

- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-c4a8209553e9/console.jsonl` (ledger at profile nav)
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-f563ba111c51/digest.json`
- `.codectx/verify/faults/fault-c957c88f.json`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-21d585b2704b/screenshot.png`

**Obscur suggestion:** Investigation spec — (1) purge vs repair for Tester1 ledger sqlite; (2) why `migrateLedgerEntries` never reduces invalid count; (3) tie `dm_kernel.sqlite_write_failed` to ledger load window.

**CodaCtrl suggestion:** Map `groups.ledger_validation_issues` → `groups-ledger-validation` on digest import; Studio Verify row should show linked `symptomId` after pull.

**Does not prove:** Purge retest, packaged build, full password unlock path.

---

### Step 2 — RIW-2 (projection authority)

**Issue:** `verify:issue:agent:7a3d72a85a8e1c35` · `symptomId: projection-authority-not-ready`

| Check | Method | Pass criterion |
|-------|--------|----------------|
| Count split | Digest `sync_restore` / M0 | `projectionConversationCount` vs `sqliteConversationCount` |
| Replay drift | `account_projection.replay_complete` | `driftStatus` value at unlock + 30s |
| Peer trust | `peer_trust_read_authority_selected` | `legacy_hold` reason documented |
| RIW-1 correlation | Same session as step 1 | Note if ledger fix changes projection |

**Obscur suggestion:** Investigation spec — why replay ingests 95+ events but projection conversation count stays 0.

**CodaCtrl suggestion:** Digest focus category for authority oscillation; timeline chart in Studio Verify.

**Prior evidence:** `.codectx/verify/faults/fault-6e8f7e13` · `csess-d0e975bc8b08`

### Step 2 re-verification (2026-07-01 — live pass)

| Field | Value |
|-------|--------|
| Session | `csess-56331621b1d9` (continued from Step 1) |
| Repro trigger | Cancel lock dialog → backup restore cycle; profile-nav authority from Step 1 in same console |
| **Authority owner** | Always `selectedAuthority: sqlite` (`sqlite_native`) — warns on every selection |
| **Count split (varies by moment)** | Lock: projection **1** vs sqlite **2**; profile nav: projection **1** vs sqlite **0**; persistedDmThreadCount toggles 0↔1 |
| **Oscillation** | `projectionReadAuthorityReason`: `projection_not_ready` → `read_cutover_enabled` within **~50ms** of each `replay_complete` |
| **Peer trust** | `selectedSource`: `legacy` → `projection` in same window; **no** `legacy_hold` this pass (differs from cold-unlock capture) |
| **replay_complete driftStatus** | **`clean`** (150–152 events) on warm session — **no `drifted` in this session**; prior capture (`fault-6e8f7e13`) still shows `drifted` on cold unlock |
| **criticalDriftCount** | **0** throughout |
| **DM / history** | `chat_state_replaced`: `dmConversationCount: 0` despite `createdConnectionCount: 2`; backup restore `restoreDmChatStateDomains: false`, all merged/applied DM counts **0**; UI shows empty thread (“start of encrypted conversation”) |
| **RIW-1 correlation** | Ledger 18/20 fires in same restore window (`cap-803e0ee2f572`) |
| Digest | `fault-991005c2` — `symptomIds: []` again |
| **Verdict** | **CONFIRMED p2 (refined)** — authority oscillation + projection/sqlite mismatch are stable; `driftStatus: drifted` is **intermittent** (cold vs warm) |

**Evidence paths (this pass):**

- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-803e0ee2f572/console.jsonl`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-79638f1e8a34/digest.json`
- `.codectx/verify/faults/fault-991005c2.json`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-efd1b97f101b/screenshot.png`

**Obscur suggestion:** Investigation spec — (1) why sqlite is authority while emitting authority warns; (2) why `sqliteConversationCount` reads 0 during profile nav but 2 after lock; (3) why backup restore skips DM domains (`restoreDmChatStateDomains: false`) leaving empty thread UI.

**CodaCtrl suggestion:** Digest should surface authority oscillation as a single timeline row; lock-dialog confirm button failed MCP click (timeout) — document selector pitfall.

**Does not prove:** Password cold-unlock path, `drifted` on every boot.

---

### Step 3 — RIW-3 (DM normalize)

**Issue:** `verify:issue:agent:df96c6996e0512a9` · `symptomId: dm-normalize-outgoing-mismatch`

| Check | Method | Pass criterion |
|-------|--------|----------------|
| Mismatch count | Digest / console | Events vs unique messages |
| UI truth | Screenshot Tester2 thread | Messages render correctly despite warns? |
| Invite correlation | Note NewTest 2 cards in thread | Document if burst is invite-kind only |

**Obscur suggestion:** Spec after RIW-2 owner clear — direction owner when sqlite is authority.

**CodaCtrl suggestion:** Filter console export by `dm_normalize` in MCP workflow guide.

**Prior evidence:** `cap-500c39b33caf` screenshot · `csess-f2191e90e578` (6 explicit + 46 LogHygiene-suppressed mismatches)

### Step 3 re-verification (2026-07-01 — live pass)

| Field | Value |
|-------|--------|
| Session | `csess-56331621b1d9` (continued from Steps 1–2) |
| Stack | Desktop `:1430` + CDP `:9230` + coordination `:8787` up |
| Repro | Manage Profiles → `/profiles` → `img[alt="Tester1"] >> nth=1` (Sign-in-here button timed out) → Tester2 thread |
| **Mismatch count (locked / early session)** | **`messaging.dm_normalize_is_outgoing_mismatch` ×36** in `cap-38ea3448efc7` digest topNames — matches original capture |
| **Mismatch count (post-unlock)** | **0** in `cap-a5d9a7ed157c` digest and `cap-11bde9168440` console — normalize path not exercised |
| **UI truth** | Tester2 thread **empty** (“start of encrypted conversation”) despite sidebar listing + invite preview text |
| **DM persistence** | Backup restore `restoreDmChatStateDomains: false`; all merged/applied DM message counts **0**; `chat_state_replaced` `dmConversationCount: 0` |
| **Relay activity** | `delete_for_everyone_remote_result` dedup ×109 in post-unlock digest — events ingested but not rendered |
| **Direction pattern (prior)** | Alternating `storedIsOutgoing` ↔ `resolvedIsOutgoing` across Tester1 (`e07f67dc`) vs Tester2 (`3db055b4`) pubkeys |
| **RIW-2 correlation** | Empty thread masks event-vs-unique-message UI check; symptom real when hydration runs, absent when DM domains skipped |
| Digest | `fault-e55e54d5` — `symptomIds: []` again |
| **Verdict** | **CONFIRMED p2 (refined)** — 36 mismatches reproducible in same session when locked; post-unlock pass **masked** by RIW-2 empty-DM state |

**Evidence paths (this pass):**

- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-38ea3448efc7/digest.json` (36× mismatch at session start)
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-a5d9a7ed157c/digest.json`
- `.codectx/verify/faults/fault-e55e54d5.json`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-11bde9168440/console.jsonl`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-c516dc13d587/screenshot.png`
- New register row: `verify:issue:agent:b208fd14aa0d3b45`

**Obscur suggestion:** Investigation spec — (1) direction owner when sqlite is authority (`dm-conversation-normalize-message.ts`); (2) why stored `isOutgoing` disagrees with sender-pubkey resolution; (3) whether mismatches are invite-kind only or all DM payloads; **blocked on RIW-2** for hydrated-thread recount.

**CodaCtrl suggestion:** Digest import should map `messaging.dm_normalize_is_outgoing_mismatch` → `dm-normalize-outgoing-mismatch`; document profile-picker selector `img[alt="Tester1"] >> nth=1` when Sign-in-here button times out.

**Does not prove:** Fix for direction normalization; message render with hydrated history; cold-restart retention (O-2).

---

### Step 4 — RIW-4 (coordination)

**Issue:** `verify:issue:agent:fe1556fff6a7792e` · `symptomId: coordination-membership-deltas-unreachable`

| Check | Method | Pass criterion |
|-------|--------|----------------|
| 8787 up | `pnpm dev:coordination` | `curl -I` membership/deltas → 200 or expected 404 |
| Browser fetch | Digest `requestfailed` | No REFUSED; CORS documented |
| Impact | Community home | Deltas poll vs local ledger load |

**Obscur suggestion:** Dev profile doc — when desktop-only is valid vs full-stack required.

**CodaCtrl suggestion:** `client_dev_environment_get` bucket `coordination-not-running` blocks community verify scenarios.

**Prior evidence:** `csess-f2191e90e578` (REFUSED) · `csess-5c26475ea529` (CORS) · `riw-4-curl-cors-probe-2026-07-01.txt`

### Step 4 re-verification (2026-07-01 — live pass)

| Field | Value |
|-------|--------|
| Session | `csess-56331621b1d9` (continued from Steps 1–3) |
| Stack | Desktop `:1430` + CDP `:9230` + coordination `:8787` up (`client_dev_environment_get` confirms wrangler-coordination open) |
| **curl GET deltas** | **404** + `Access-Control-Allow-Origin: *` (expected for unknown community fixture ID) |
| **curl OPTIONS** | **204** + `ACAO: *` |
| **Browser requestfailed @ :8787** | **0×** in entire session — no `CONNECTION_REFUSED`, no CORS policy console errors |
| **Health scan** | `healthy: true`; findings: multi-window CDP, `:7000` refused, `relay.internal` — **no** coordination-not-running bucket |
| **Repro triggers** | Manage Profiles → `/profiles`; Group tab shows **NewTest 2** (“Group key unavailable on this device”) |
| **Impact** | Background delta poll only; unlock/DM/chat work without coordination; community roster blocked by **local** room-key gap (RIW-1), not HTTP reachability |
| **Prior CORS (2026-06-30)** | **Not reproduced** this pass with wrangler up |
| **Prior REFUSED (desktop-only)** | Still valid when `:8787` down — dev-env gap, not product regression |
| Digest | `fault-3c69d3a8` — `symptomIds: []` |
| **Verdict** | **CONFIRMED p2 (refined)** — tiered: desktop-only REFUSED is expected dev gap; full-stack curl CORS OK; browser shows no failed fetches when coordination up (404s are silent successes in CDP console) |

**Evidence paths (this pass):**

- `.codectx/verify/artifacts/riw-4-curl-cors-probe-2026-07-01-step4.txt`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-43dc28edcd6e/console.jsonl`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-e58fe94923c0/digest.json`
- `.codectx/verify/faults/fault-3c69d3a8.json`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-e557cdac9c04/screenshot.png`
- New register row: `verify:issue:agent:3998a202591a45aa`

**Obscur suggestion:** Dev profile doc — classify desktop-only vs full-stack; document that 404 delta responses are handled in-app without console noise; COM-RUN steps require `:8787` + `:7000` preflight.

**CodaCtrl suggestion:** Health scan should bucket `0× :8787 failures + coordination port open` as `coordination-reachable`; network HAR capture for silent 404 delta polls; preflight gate before COM-RUN-*.

**Does not prove:** COM-RUN-01 roster parity; NewTest 2 community home click (sidebar row timed out); count of successful 404 delta polls.

---

### Step 5 — COM-RUN-01 + COM-RUN-11 (community roster + invite UX)

**Issues:** COM-RUN-01 (roster divergence) · COM-RUN-11 (invite role collapse)  
**Proof tier required:** **t4** (two native profile windows)

| Check | Method | Pass criterion |
|-------|--------|----------------|
| Two profiles | Profile picker + CDP | Tester1 + Tester2 windows independently attachable |
| Full stack | `:8787` + `ws://localhost:7000` | Coordination up; team relay connected |
| COM-RUN-01 | NewTest 2 participants modal both windows | Same member set (or documented divergence) |
| COM-RUN-11 | Live invite card on sender + receiver | Invitee sees Accept; inviter sees Cancel — not both Cancel |

**Obscur suggestion:** COM-MEM-2 manual with graph worksheet; purge fixture before clean roster retest.

**CodaCtrl suggestion:** Multi-window checklist (RIW-7); block COM-RUN steps when `targetCount < 2` or `:7000` refused.

**Prior evidence:** Maintainer screenshots 2026-06; `csess-5c26475ea529` multi-window CORS pass

### Step 5 re-verification (2026-07-01 — live pass)

| Field | Value |
|-------|--------|
| Session | `csess-56331621b1d9` |
| Stack | `:8787` up · `:7000` **down** (REFUSED) · `:1430` desktop · **1 CDP target** (RIW-7) |
| Second profile | Profile picker shows **Tester1 only** + empty “Needs setup” slot — **Tester2 window not available** |
| **COM-RUN-01 (Tester1)** | Opened NewTest 2 via `text=NewTest 2` → group home `/groups/view?id=b93f53e23d8c4456835afd3f4d3a627b` |
| **Participants modal** | **Online: Tester1 only**; Offline: none; **Tester2 absent** |
| **Header inconsistency** | Sidebar thread header claimed **“2 members· 1 online”** while participants shows **1** |
| **Diagnostics** | `groups.page.participant_projection_state`: `visibleParticipantCount: 1`, `knownParticipantCount: 0`, `rosterProjectionCount: 1` |
| **Health blockers** | `groups.membership_health_snapshot`: `room_key_missing`, `relay_not_connected` (`ws://localhost:7000`) |
| **RIW-1 correlation** | `groupId: b93f53e23d8c4456835afd3f4d3a627b` — same ledger-invalid group from Step 1 |
| **COM-RUN-11** | **Not exercised live** — dual-profile + fresh invite required; historical Tester2 DM (`cap-06d82f269d28`) shows **6× NewTest 2 invite cards** in superseded/canceled terminal states only |
| **MCP blockers** | `Add New profile` timeout; participants modal overlay blocked navigation clicks |
| **Verdict** | **PARTIAL** — COM-RUN-01 **CONFIRMED p0** on Tester1 (single-window t3); COM-RUN-11 **BLOCKED** (t4 not met) |

**Evidence paths (this pass):**

- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-cd2f1c4a0557/console.jsonl` (group thread + DB locked pageerrors)
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-4ab4ca7b11c4/console.jsonl` (group home + membership health)
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-2e28ddad53c0/snapshot.yaml` (participants modal)
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-e0750287c64a/screenshot.png`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-ce884f7cf1a7/digest.json` · `fault-27f72a5e`
- Register: `verify:issue:agent:e19043148dd92abb` (COM-RUN-01) · `verify:issue:agent:bc1423936905096b` (COM-RUN-11 blocked)

**Obscur suggestion:** Investigation spec — roster read owner when coordination directory thin + ledger invalid; start `:7000` before COM-RUN retest; configure Tester2 as second desktop profile for COM-MEM-2.

**CodaCtrl suggestion:** Preflight gate: `targetCount < 2` → skip COM-RUN with explicit blocked status; document `text=NewTest 2` selector for sidebar community row.

**Does not prove:** Tester2-window roster; live Accept/Cancel invite matrix; roster after relay `:7000` up; COM-MEM-2 soak.

### Step 5 round21 (2026-07-02 — dual-window COM-RUN capture)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round21` |
| **COM-RUN-01** | T1 participants **Tester1 only**; T2 Group sidebar **empty** — **t4 confirmed** |
| **COM-RUN-11** | **Blocked** — historical superseded invite cards only |
| Export | `20260702162046` |

### Step 5 round22a (2026-07-02 — fixture purge)

| Field | Value |
|-------|--------|
| Charter | [`com-run-11-fixture-setup-2026-07.md`](./com-run-11-fixture-setup-2026-07.md) |
| Coordination D1 | **Cleared** |
| EBWebView | **Removed** for `default` + `profile-2` (manual fallback after Playwright hang) |
| **Next** | Round 22b: restart desktop → recreate NewTest 2 → fresh invite → COM-RUN-11 matrix |

---

| Row | Repro sketch | Proof tier |
|-----|--------------|------------|
| O-4 | Send group message → relay → second profile ingest | t3 + full stack |

Case study reference: CodaCtrl repo case study **obscur-green-ci-red-runtime** (external — not in this monorepo) — symptoms O-1–O-5.

---

### Step 7 — O-4 (group thread relay round-trip)

**Issue:** O-4 · Group thread messages never appear from relay  
**Proof tier:** **t3 + full stack** — send in NewTest 2 → relay `:7000` → second profile ingest  
**Chain:** `chain-o4-group-ingest-2026-07-02`

| Check | Method | Pass criterion |
|-------|--------|----------------|
| Stack | coordination `:8787` + team relay `:7000` | Both listening |
| Unlock | Tester1 session | Unlocked shell, not `/sign-in` |
| Open community | `text=NewTest 2` click | Group thread loads |
| Send message | MCP type + Send | Message renders in thread |
| Relay signal | Console / digest | Group publish + ingest events |
| Second profile | Tester2 window (blocked t4) | Message visible on joiner |

### Step 7 re-verification (2026-07-02 — live pass)

| Field | Value |
|-------|--------|
| Session | `csess-5f10d872d481` |
| **Coordination** | `:8787` up (wrangler dev) |
| **Team relay** | `pnpm dev:relay` **skipped** — Docker optional; `:7000` not listening (use `pnpm dev:relay:docker` for local relay) |
| **Desktop** | `/sign-in` password gate — **BLOCKED** |
| **MCP golden path** | Steps 7–8 executed: screenshot `cap-7ca9fc190c3a`, digest `fault-0196a614` |
| **Verify golden path step 7** | `verify_trace_latest` — real-time timeline aggregates 28 issues + latest fault imports |
| **Chain node** | `n0-stack-preflight` captured; send/ingest nodes not run |
| **Verdict** | **BLOCKED t3** — auth gate; `:7000` not up |

### Step 7 re-verification continued (2026-07-02 — credentials + unlocked session)

| Field | Value |
|-------|--------|
| Session | `csess-6461739df98d` |
| **Fixture doc** | `docs/program/obscur-dev-test-accounts.md` (matches `dev-test-accounts.ts`) |
| **Unlock** | Maintainer had Tester1 unlocked on attach (no MCP password entry this pass) |
| **NewTest 2 open** | Group tab → `role=button[name*="NewTest 2"]` — thread **hydrates** (4 messages in main pane) |
| **Sidebar signal** | `Group key unavailable on this device` |
| **Ledger** | `groups.ledger_validation_issues` 18/20; sample `b93f53e2…` missing `publicKeyHex` |
| **Send attempt** | `O4-group-relay-verify-071T1128` — **stuck in composer** after Send click |
| **Relay** | `ws://localhost:7000` ERR_CONNECTION_REFUSED (public relays active 1/6) |
| **Chain** | `n1-send-blocked-group-key` — hypothesis links **COM-RUN-02** room key band |
| **Verdict** | **PARTIAL t3** — ingest/history path works; **send + relay round-trip not demonstrated** |

**Evidence paths (continued pass):**

- `.codectx/verify/chains/chain-o4-group-ingest-2026-07-02/nodes/n1-send-blocked-group-key.json`
- `.codectx/verify/faults/fault-579ab524.json`
- `.codectx/verify/client-sessions/csess-6461739df98d/captures/cap-2213f5ef81f0/screenshot.png`
- Register: `verify:issue:agent:7830537bf84fba67`

**Does not prove:** Tester2 ingest; local `:7000` relay path; O-4 fixed.

### Step 7 round2 (2026-07-02 — CodaCtrl boot-artifacts pass)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-boot-artifacts-round-r2` |
| Session | `csess-510a62aba320` |
| **NewTest 2** | Thread hydrates (4 msgs); sidebar **Group key unavailable on this device** |
| **Send** | `O4-round2-codactrl-071T1409` — composer clears, **no new bubble** |
| **Chain node** | `n2-round2-send-blocked` · digest `fault-d91cd690` (split `.digest.json`) |
| **Ledger** | 18/20 invalid on DM thread open (unchanged) |
| **Register** | `verify:issue:agent:310fbc54fc6305c5` · `trackerStep: 7` |
| **Verdict** | **PARTIAL t3** — unchanged band; links **COM-RUN-02** room key |

**Evidence:** `.codectx/verify/chains/chain-o4-group-ingest-2026-07-02/nodes/n2-round2-send-blocked.json`

### Step 7 round3 (2026-07-02 — CodaCtrl dedup/export update)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round3` |
| Session | `csess-322a4af06321` |
| **Stack** | Coordination restarted `:8787`; desktop warm on NewTest 2 community home |
| **COM-RUN-01 nuance** | Manage → Participants lists **Tester1 + Tester2** (2 participants); home card still **Tester1 only** |
| **O-4 send** | `O4-round3-codactrl-071T1654` — composer clears, **no bubble**; sidebar group-key warning |
| **Chain node** | `n3-round3-send-blocked` · digest `fault-4a171a35` |
| **Register** | `verify:issue:agent:54e729aec49eeda1` · `chapterCount: 4` |
| **Verdict** | **PARTIAL t3** — blocked on group key (COM-RUN-02 band) |

**CodaCtrl validated:** `priorChapters`, `canonicalTitle`, collapsed fault row in rollup, `export-manifest.json`.

### Step 7 round4 (2026-07-02 — COM-RUN-02 health snapshot + CodaCtrl export)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round4` |
| Session | `csess-631c3bba5207` |
| **Stack** | Coordination `:8787` up; desktop warm; **`:7000` relay down** (no Docker relay) |
| **Community home** | Info → `/groups/view?id=b93f53e2…` — thread **hydrates** (4 msgs in history) |
| **Health snapshot** | `groups.membership_health_snapshot`: `ready:0`, `chatEnabled:0` |
| **Blockers (cascade)** | `room_key_missing,coordination_missing_peer,relay_not_connected` → `coordination_missing_peer,relay_not_connected` → `relay_not_connected` |
| **Recovery actions** | `invite_redemption,retry_join,configure_relays` |
| **Coordination path** | Browser **403** on `/membership/delta` (singular); curl `/membership/deltas` → **200**, `/membership/delta` → **404** |
| **Ledger** | 18/20 invalid unchanged; sample `b93f53e2…` missing `publicKeyHex` |
| **Chain node** | `n4-room-key-health-snapshot` · digest `fault-fc0c8590` |
| **Register** | `verify:issue:agent:43cde0c4b744b301` · `symptomId: group-room-key-missing` · `trackerStep: 7` |
| **Export** | `.codactrl/verify/issue-report/export-manifest.json` · pass archive `20260701165850` · register **38** rows |
| **Verdict** | **PARTIAL t3** — COM-RUN-02 **confirmed** via structured health blockers; O-4 send still blocked |

**Evidence paths:**

- `.codectx/verify/chains/chain-o4-group-ingest-2026-07-02/nodes/n4-room-key-health-snapshot.json`
- `.codectx/verify/client-sessions/csess-631c3bba5207/captures/cap-e38e482a6206/console.jsonl`
- `.codectx/verify/client-sessions/csess-631c3bba5207/captures/cap-dc3e1df76466/screenshot.png`
- `.codectx/verify/faults/fault-fc0c8590.digest.json`

**Obscur suggestion:** Investigation spec — (1) why client calls `/membership/delta` vs server `/membership/deltas`; (2) room key present in backup merge (`mergedRoomKeyCount: 1`) but `room_key_missing` at runtime; (3) retest with `pnpm dev:relay:docker` for `:7000`.

**Does not prove:** Room key repair; invite redemption success; O-4 relay round-trip; Tester2 ingest.

### Step 7 round5 (2026-07-02 — O-4 retry, Docker relay blocked)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round5` |
| Session | `csess-631c3bba5207` (continued) |
| **Relay attempt** | `pnpm dev:relay:docker` → **failed** — Docker Desktop not running |
| **NewTest 2** | Thread hydrates (4 msgs); sidebar **Group key unavailable on this device** |
| **Send** | `O4-round5-relay-blocked-071T1714` — composer clears, **no bubble** |
| **Chain node** | `n5-round5-send-blocked-no-docker` · digest `fault-bf3a84e1` |
| **Register** | `verify:issue:agent:bf6c693835f7e2c3` · `group-thread-relay-ingest` chapter **5** |
| **Export** | pass archive `20260701171404` · register **39** rows |
| **Verdict** | **PARTIAL t3** — unchanged band; **cannot isolate relay-only variable** without Docker |

**Does not prove:** Whether `:7000` up would clear `relay_not_connected`; room key repair; O-4 fixed.

### Step 7 round6 (2026-07-02 — full stack send success)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round6` |
| Session | `csess-631c3bba5207` (continued) |
| **Stack** | `pnpm dev:relay:docker` **up** · `:7000` HTTP 200 · relays **2/6** connected |
| **Health cascade** (Info page) | warn `room_key_missing` → info `ready:1`, `chatEnabled:1`, blockers cleared |
| **Relay UI** | Community home: **Connected & optimized** · `ws://localhost:7000` |
| **Send** | `O4-round6-docker-up-071T1728` — **bubble visible** “Just now” |
| **Publish** | `[publishGroupEvent]` → `ws://localhost:7000` · eventIdHint `3c2b3523…5dd8b8b3` |
| **Sidebar** | Still **Group key unavailable on this device** (stale vs health ready) |
| **Chain node** | `n6-round6-health-recovered-docker` · digest `fault-1285de34` · main=**5** msgs |
| **Register** | `verify:issue:agent:5c5e1b25c17e9dca` · `group-thread-relay-ingest` chapter **6** |
| **Artifact** | `.codectx/verify/artifacts/com-run-02-membership-path-probe-2026-07-02.txt` |
| **Export** | pass archive `20260701172908` · register **40** rows |
| **Verdict** | **PARTIAL t3 (send path verified)** — full stack required; **Tester2 ingest not demonstrated** |

**Obscur suggestion:** Investigation spec — (1) why sidebar group-key warning does not clear when `membership_health_snapshot` reaches ready; (2) health depends on coordination + team relay cascade, not room key alone on partial stack; (3) app uses `localhost:8787` in some requests (REFUSED) vs `127.0.0.1:8787` preflight.

**Does not prove:** O-4 fixed on desktop-only/public-relay stack; second-profile ingest; sidebar label sync.

### Step 7 round7 (2026-07-02 — send repro + COM-RUN-01 re-check)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round7` |
| Session | `csess-631c3bba5207` |
| **Stack** | Docker `infra-nostr-relay-1` Up · coordination `:8787` restarted Ready |
| **Send repro** | `O4-round7-fullstack-071T1733` — bubble **Just now** · eventIdHint `2d1a9735…0cdc31cf` |
| **Thread** | **6** messages (round6 + round7 sends persist) |
| **Health** | Info: `ready:1`, `chatEnabled:1` · Relay **Connected & optimized** |
| **COM-RUN-01** | Manage → Participants: **1 participant** (Tester1 only); chat header still **2 members**; home card Tester1 only |
| **Coordination** | Browser **403** on `/membership/delta` (unchanged) |
| **Sidebar** | Still **Group key unavailable** (stale) |
| **Chain nodes** | `n7-round7-stack-preflight`, `n8-round7-send-repro` |
| **Register** | `verify:issue:agent:13f19914b4ba6366` (O-4) · `verify:issue:agent:6ff2b79a949767b3` (COM-RUN-01) |
| **Export** | pass archive `20260701173438` · register **43** rows |
| **Verdict** | **PARTIAL t3 (send reproducible)** — full stack required; roster surfaces still diverge |

**Does not prove:** Tester2 ingest; COM-RUN-01 fixed; cold-start send without prior health cascade.

### Step 7 round8 (2026-07-02 — cold-start send without Info cascade)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round8` |
| Session | `csess-b20deab2382f` |
| **Stack** | Docker `infra-nostr-relay-1` Up · coordination `:8787` Up · desktop cold-killed then relaunched |
| **Protocol** | Full stack already running → `taskkill obscur_desktop_app.exe` → `pnpm dev:desktop --online --skip-build` → password unlock → **NewTest 2 directly (Info not visited)** |
| **Pre-send** | Sidebar **Group key unavailable**; compose Send **disabled** until text entered |
| **Send** | `O4-round8-coldstart-071T1746` — bubble **Just now** |
| **Publish** | `[publishGroupEvent]` → `ws://localhost:7000` · eventIdHint `8b138f20…307752d5` |
| **Thread** | **7** messages (round6–8 sends persist) |
| **Sidebar** | Still **Group key unavailable** (stale vs successful send) |
| **Chain nodes** | `n9-round8-coldstart-preflight`, `n10-round8-coldstart-send-repro` |
| **Register** | `verify:issue:agent:f21d04768c6b0594` |
| **Export** | pass archive `20260701174731` · register **45** rows |
| **Verdict** | **PARTIAL t4 (cold-start send verified)** — Info health cascade **not required** when Docker+coordination up; sidebar label still stale |

**Obscur suggestion:** Refine COM-RUN-02 investigation — sidebar “Group key unavailable” is not a reliable send gate when full stack is up; document why compose enables after keystroke despite sidebar warning.

**Does not prove:** Tester2 ingest; O-4 fixed on partial stack; sidebar label sync; send blocked on cold start without full stack.

### Step 7 round9 (2026-07-02 — COM-RUN-02 investigation closeout)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round9` |
| Session | `csess-87ec64010847` |
| **Focus** | Sidebar vs `membership_health_snapshot` divergence; coordination path probe |
| **Health cascade** (Info → community home) | warn `room_key_missing` → info **`ready:1`, `chatEnabled:1`** (~50ms) |
| **Sidebar after ready** | Still **Group key unavailable on this device** (ledger placeholder owner) |
| **Coordination curl** | GET `/membership/deltas` **200** · GET `/membership/delta` **404** (POST-only) · POST empty **400** |
| **Code owner (sidebar string)** | `LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE` · `community-membership-ledger.ts` |
| **Investigation spec** | `specs/backend/com-run-02-membership-health-sidebar-investigation.md` |
| **Artifact** | `.codectx/verify/artifacts/com-run-02-membership-path-probe-2026-07-02.txt` (updated) |
| **Register** | `verify:issue:agent:d6aaccca65754776` |
| **Export** | pass archive `20260701180132` · register **46** rows |
| **Verdict** | **Investigation spec filed** — parallel read models confirmed; implementation deferred |

**Does not prove:** Sidebar fix; Tester2 joiner room key; browser 403 on misrouted GET delta.

### Step 7 round10 (2026-07-02 — CodaCtrl update pass, partial stack)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round10` |
| Session | `csess-ad3b3e90aa04` |
| **Stack** | Coordination `:8787` up · **Docker down** (`pnpm dev:relay:docker` failed) |
| **CodaCtrl** | Register `@0.3.0` triage: **14** symptom rows + unmapped ×33; `verify_issues_promote` COM-RUN-02 → **spec**; `meta-chain.json` exported |
| **RIW-1** | Ledger **18/20 invalid** unchanged (`needsMigrationCount: 9`) |
| **COM-RUN-01** | Manage **1** participant; chat header **2 members**; home card Tester1 only |
| **COM-RUN-02** | Health `relay_not_connected`; UI relay card still "Connected & optimized" |
| **O-4 send** | `O4-round10-no-docker-071T2206` — composer clears, **no bubble**; thread stays **7** msgs |
| **Chain node** | `n11-round10-no-docker-send-blocked` |
| **Register** | `verify:issue:agent:e1447144f354579c` (O-4) · `verify:issue:agent:160130f274c53ad5` (COM-RUN-01) |
| **Export** | pass archive `20260701220635` · register **15** triage rows |
| **Verdict** | **PARTIAL t3** — send blocked without `:7000`; confirms round5/round10 isolation variable |

**Does not prove:** Full-stack send; Tester2 ingest; register triage on pre-restart daemon.

### Step 7 round11 (2026-07-02 — CodaCtrl feedback validation + multi-window probe)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round11` |
| Session | `csess-af73d0bd5b5c` |
| **Stack** | Coordination `:8787` up · **Docker down** |
| **CodaCtrl** | Dogfood preflight **all green**; `promotionStage` on register row (`d6aaccca…`→spec); dm-split-brain chain rollup → **partial_accepted** |
| **Multi-window** | Profile slot opened native second window; **`:9231` down**; `list_targets` still **1** page on `:9230` |
| **COM-RUN-01** | Manage Participants **1** (Tester1); chat header **2 members** |
| **COM-RUN-02** | Health `relay_not_connected`; UI relay card "Connected & optimized" |
| **RIW-1** | Ledger **18/20 invalid** unchanged |
| **O-4 send** | `O4-round11-partial-071T2237` — composer clears, **no bubble** |
| **Chain node** | `n12-round11-multiwindow-partial-stack` |
| **Register** | `verify:issue:agent:efa90322468050a8` (O-4 ×10) · `verify:issue:agent:28409ff90609b8c9` (multi-window ×2) · `verify:issue:agent:3d6e95773575f422` (COM-RUN-01 ×5) |
| **Export** | pass archive `20260701223753` |
| **Verdict** | **PARTIAL t3** — second window not CDP-drivable; send blocked without `:7000` |

**Does not prove:** Tester2 profile setup; second-window MCP control; full-stack send.

### Step 7 round12 (2026-07-02 — CodaCtrl v1.4 trace desk + full stack)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round12` |
| Session | `csess-ad9e7520da13` |
| **Stack** | Docker `:7000` up · Coordination `:8787` up |
| **CodaCtrl** | Workflow guide **v1.4.0** (`traceDesk`, `coldRestartProve`); `verify_trace_latest` + `verify_envelope_suggest` validated |
| **O-4 send** | `O4-round12-partial-072T0836` — **success**; bubble visible; `publishGroupEvent` @ `:7000` (event `37b6a5b9`) |
| **COM-RUN-01** | Manage Participants **1** (Tester1); chat header **2 members** — unchanged |
| **RIW-1** | Ledger **18/20 invalid** unchanged |
| **Sidebar** | Group key unavailable warning **stale** |
| **Chain node** | `n13-round12-fullstack-send-success` (14 nodes) |
| **Register** | `verify:issue:agent:58b1f5e0e01e5316` (O-4 ×11) · `verify:issue:agent:45467cd4d3b00f21` (COM-RUN-01 ×6) |
| **Export** | pass archive `20260702084757` |
| **Verdict** | **PARTIAL t3** — sender-side send verified; no Tester2 ingest; chain rollup still `blocked_on_harness` |

**Does not prove:** Tester2 relay ingest; COM-RUN-02 sidebar fix; roster parity.

### Step 7 round13 (2026-07-02 — post-rebuild + agent bridge)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round13` |
| Session | `csess-937c30f83699` |
| **Stack** | Docker `:7000` up · Coordination `:8787` up · static shell **rebuilt** (`--rebuild`) |
| **Build fixes** | `codactrl-agent-bridge.ts` Tauri v2 imports; `card.tsx` subcomponents; `thread-history/index.ts` duplicate export |
| **Agent bridge** | `listWindows` **2** (`main` + `profile-profile-2-*`); `openProfileSlot(2)` **ok**; `focusWindow` **ACL denied** (`core:window:allow-set-focus`) |
| **O-4 send** | `O4-round13-rebuild-072T0958` — **success**; `publishGroupEvent` @ `:7000` (event `9a615480`) |
| **COM-RUN-01** | Participants evidence **Tester1 only**; chat header **2 members** — unchanged |
| **CDP** | Still **1 target** on `:9230`; `:9231` down |
| **Chain nodes** | `n14-round13-rebuild-send-success` · `n15-round13-bridge-multiwindow-partial` (15 nodes) |
| **Register** | `verify:issue:agent:b24bb36ac9f8c8e4` (O-4 ×12) · `verify:issue:agent:76b14118afac2838` (multi-window ×3) · `verify:issue:agent:2884361320a7595f` (COM-RUN-01 ×7) |
| **Export** | pass archive `20260702095924` |
| **Verdict** | **PARTIAL t3** — bridge lane unlocks window enumeration + open; CDP/UI on profile-2 still blocked |

**Does not prove:** Tester2 unlock on profile-2 window; second-window CDP attach; COM-RUN-11 full ingest.

### Step 7 round14 (2026-07-02 — ACL/CDP rebuild + focus IPC)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round14` |
| Session | `csess-c9e4cc0c3649` |
| **Stack** | Docker `:7000` up · Coordination `:8787` up · static shell **rebuilt** (`--rebuild`) with `desktop_agent_focus_window` + profile `:9231` args |
| **Agent bridge** | `listWindows` **2**; `openProfileSlot(2)` **ok**; `focusWindow` **ok** via `desktop_agent_focus_window` IPC (`bcap-dd2fa5076a2f`) |
| **O-4 send** | `O4-round14-acl-cdp-072T1102` — **success** (Just now bubble) |
| **COM-RUN-01** | Manage Participants **Tester1 only**; chat header **2 members** — unchanged |
| **CDP** | Still **1 target** on `:9230`; `:9231` **not listening** (WebView2 per-window CDP gap) |
| **Chain nodes** | `n16-round14-send-success` · `n17-round14-bridge-focus-ipc` (18 nodes; n14 now linked in manifest) |
| **Register** | `verify:issue:agent:41aeddb8d5f42614` (O-4 ×13) · `verify:issue:agent:3e93540c9bc415ab` (COM-RUN-11 ×6) · `verify:issue:agent:2990ecfa08aadc32` (COM-RUN-01 ×8) |
| **Export** | pass archive `20260702110342` |
| **Verdict** | **PARTIAL t3** — focus IPC unblocks bridge lane; dual CDP attach still blocked |

**Does not prove:** Tester2 UI automation on profile-2 webview; COM-RUN-11 full dual-profile ingest.

### Step 7 round15 (2026-07-02 — per-window CDP :9231 fix)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round15` |
| Session | `csess-d39f4ab009ee` (main) · `csess-9530bb91b194` (profile `:9231`) |
| **Root cause** | Process-wide `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230` blocked second environment from binding `:9231` |
| **Fix** | Per-window `additional_browser_args` on main (`OBSCUR_CDP_MAIN` / `:9230`) + profile (`OBSCUR_CDP_PROFILE` / `:9231`); `dev-desktop-static.mjs` **deletes** global `WEBVIEW2_*` |
| **CDP** | `:9230` main · `:9231` profile — **both listening** after `openProfileSlot(2)` |
| **MCP attach** | `client_session_connect` @ `:9231` → profile sign-in target |
| **Chain node** | `n18-round15-profile-cdp-attach` (19 nodes) |
| **Register** | `verify:issue:agent:915034dcac55e53d` (COM-RUN-11 ×7) |
| **Export** | pass archive `20260702111456` |
| **Verdict** | **PARTIAL t3 → t4 harness** — dual CDP attach unblocked; Tester2 unlock/send on profile-2 not yet exercised |

**Does not prove:** COM-RUN-11 end-to-end (Tester2 sends/receives on profile-2 window).

### Step 7 round16 (2026-07-02 — dual-profile harness send)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round16` |
| Sessions | `csess-1462fcbd345e` (main `:9230`) · `csess-e440bdda1773` (profile `:9231`) |
| **Tester2 unlock** | **Works** — password + `form button[type="submit"]` on profile sign-in |
| **Tester2 send** | **Works** — DM `O4-round16-profile2-072T1118` via `:9231` |
| **Tester1 send** | **Works** — community `O4-round16-dual-profile-072T1117` via `:9230` |
| **Probe** | `dualWindowReady: true` (CDP ports; bridge race on standalone probe) |
| **Chain node** | `n19-round16-profile2-unlock-send` (20 nodes) |
| **Export** | pass archive `20260702111911` |
| **Verdict** | **PARTIAL COM-RUN-11** — dual-profile automation proven; invite UX + Tester2 community sidebar still blocked |

**Does not prove:** COM-RUN-11 invite Accept/Cancel matrix; Tester2 NewTest 2 community membership/send.

### Step 7 round17 (2026-07-02 — CodaCtrl stack preflight update)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round17` |
| Sessions | `csess-8abe3d68a490` (main `:9230`) · `csess-a256b15c946e` (profile `:9231`) |
| **CodaCtrl new** | `client_stack_preflight` — **blocks** `client_session_connect` until `:7000` + `:8787` + `:9230` |
| **Preflight result** | Blocked initially (no desktop/Docker); after boot still blocked on `:7000` (Docker down) |
| **Bypass** | `skipStackPreflight: true` on connect (documented escape hatch) |
| **windowLabel fix** | Profile `:9231` session → **`profile-2`** (was mislabeled `main` in R16) |
| **Dual harness** | Tester2 unlock + DM `O4-round17-profile2-072T1247` on `:9231` |
| **O-4 send** | **Blocked** — no Docker `:7000`; composer clears, no bubble (expected) |
| **Chain node** | `n20-round17-stack-preflight-dual` (21 nodes) |
| **Export** | MCP export **failed** (codactrld timeout); chain nodes n20+n21 captured |
| **Verdict** | **PARTIAL → send success with Docker** — CC-EVAL-01 validated; O-4 send `O4-round17b-docker-072T1323` after Docker up |

**Does not prove:** O-4 group send without local relay; export bundle (operator Studio sync required).

### Step 7 round17b (2026-07-02 — Docker retry, full stack send)

| Field | Value |
|-------|--------|
| Session | `csess-6f1a35b7762b` |
| **Stack preflight** | **All green** — structured JSON `client.stack.preflight@1.0.0` |
| **Connect** | **No skipStackPreflight** — attach succeeded |
| **O-4 send** | **`O4-round17b-docker-072T1323` visible** · 2/6 relays · `:7000` up |
| **Chain node** | `n21-round17b-docker-send-success` (22 nodes) |

### Step 7 round18 (2026-07-02 — CodaCtrl export coherence upgrade)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round18` |
| Sessions | `csess-6f1a35b7762b` (main `:9230`) · `csess-624f7d067178` (profile `:9231`) |
| **CodaCtrl new** | `export-bundle-coherence.json` — atomic export bundle validation |
| **Stack** | Docker `:7000` up · coordination `:8787` cold-start (wrangler >3 min) · used `skipStackPreflight` |
| **Preflight** | Blocked on `:8787` until wrangler ready; relay + CDP green |
| **O-4 send** | **`O4-round18-codactrl-072T1445` visible** · composer cleared · bubble "Just now" |
| **Dual harness** | `openProfileSlot(2)` → `:9231` attach · `windowLabel: profile-2` |
| **Chain node** | `n22-round18-codactrl-send-success` (23 nodes) |
| **Export** | MCP `verify_issues_report_export` **succeeded** · pass archive `20260702144547` |
| **Verdict rollup** | **`partial_accepted`** · primary evidence `cap-a45dd4eacd8f` · `nonCoverage` COM-RUN-11/01 |
| **Export coherence** | **`coherent: true`** — manifest, rollup, handoff, lite, repro all `14:45:47` |

**Does not prove:** COM-RUN-11 invite Accept/Cancel; COM-RUN-01 roster parity; O-4 without coordination `:8787`.

### Step 7 round19 (2026-07-02 — dual-profile interactive DM)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round19` |
| Sessions | `csess-6f1a35b7762b` (T1 `:9230`) · `csess-64c34e63c6eb` (T2 `:9231`) |
| **Stack preflight** | Full stack green (after coordination warm) |
| **DM send** | `DM-round19-t1-072T1452` (T1→T2) · `DM-round19-t2-072T1453` (T2→T1) — both visible both profiles |
| **Chain node** | `n7-round19-dual-dm-roundtrip` on `chain-dm-split-brain-2026-07-02` |
| **Export** | `20260702145344` · `export-bundle-coherence.json` → `coherent: true` |
| **Chain integrity** | DM chain **dangling edge** `n6-round16-dual-profile-dm` → n7 (node id typo from round 16) |

**Does not prove:** COM-RUN-11 fresh invite; cold-restart DM retention.

### Step 7 round20 (2026-07-02 — CodaCtrl CC-EVAL-29–32 validation)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-round20` |
| Sessions | `csess-6f1a35b7762b` (T1 `:9230`, 60+ steps) · `csess-b91e16538053` (T2 `:9231`, new session) |
| **CodaCtrl new** | Selector pack v1.1 (`unlock-password`, `unlock-submit`, `dm-compose`, `send-message`); scenario template catalog; `chain-integrity.json` |
| **Stack** | Docker `:7000` up · coordination `:8787` **intermittent** (ERR_CONNECTION_REFUSED on unlock) · `skipStackPreflight` used for connect |
| **Dual DM** | `DM-round20-codactrl-t1-072T1609` · `DM-round20-codactrl-t2-072T1609` — `client_validate_assert` **pass** both profiles |
| **O-4 send** | **`O4-round20-codactrl-072T1611` visible** · `[publishGroupEvent]` → `ws://localhost:7000` · eventIdHint `16a2c912…d5f04d61` |
| **NewTest 2 open** | `role=button[name*="NewTest 2"]` — sidebar still shows **Group key unavailable on this device** |
| **Digest pull** | T1 `symptomIds`: `groups-ledger-validation`, `dm-normalize-is-outgoing-mismatch` · T2 `symptomIds`: `groups-ledger-validation` |
| **Chain nodes** | `n8-round20-dual-dm-roundtrip` (DM) · `n23-round20-o4-send` (O-4; edge auto-corrected to `n22-round18-codactrl-send-success`) |
| **Export** | MCP `verify_issues_report_export` **succeeded** · pass archive `20260702161159` |
| **Export coherence** | **`coherent: true`** — 10 artifacts same `exportedAt` |
| **Chain integrity** | **`coherent: false`** — legacy dangling edge on DM chain (`n6-round16-dual-profile-dm` → n7) |
| **Multi-session repro** | `repro.sessions` includes round20 pair (`csess-6f1a35b7762b` + `csess-b91e16538053` @ `:9231`) among historical sessions |

**Obscur signals (fixture debt, not harness failure):** `groups.ledger_validation_issues` 18/20 entries; `CommunityLedger` historical validation; coordination delta polls refused during unlock.

**Does not prove:** COM-RUN-11 invite Accept/Cancel; group-key sidebar warning cleared; chain integrity repair of round-16 typo edge.

---

### Step 6 — O-2 (cold-restart DM retention)

**Issue:** O-2 · Outgoing DM vanishes after cold restart  
**Proof tier:** **t4** — send → kill exe → restart → hydrate → assert visible

| Check | Method | Pass criterion |
|-------|--------|----------------|
| Pre-send state | Tester2 thread | Document empty vs hydrated baseline |
| Send DM | MCP type + Send | Message renders in thread |
| Pre-restart proof | Screenshot + digest | `backup_publish` dm_history_changed |
| Cold restart | `taskkill obscur_desktop_app.exe` + relaunch | New CDP target |
| Post-restart | Unlock → Tester2 thread | Message `O2-coldrestart-verify-*` still visible |

**Obscur suggestion:** Tie to RIW-2 backup restore skipping DM domains; native session restore on cold kill.

**CodaCtrl suggestion:** Cold-restart scenario template (P2 backlog); password unlock step in checklist.

**Prior evidence:** CodaCtrl case study **obscur-green-ci-red-runtime** O-2 (external repo)

### Step 6 re-verification (2026-07-01 — live pass)

| Field | Value |
|-------|--------|
| Session | `csess-56331621b1d9` |
| **Pre-send baseline** | Tester2 thread **empty** (“start of encrypted conversation”) — same as Steps 1–3 |
| **Sent message** | `O2-coldrestart-verify-071T0720` |
| **eventId** | `58fbac8bb655f0b8` |
| **Pre-restart UI** | Message **visible** in thread + sidebar preview (`cap-a321f957a618`, `cap-4d18726a2701`) |
| **Pre-restart persistence signal** | `account_sync.backup_publish_result` `reason=dm_history_changed` `result=ok` |
| **Cold restart** | `taskkill //F //IM obscur_desktop_app.exe` → `pnpm dev:desktop -- --online --skip-build` |
| **Post-restart boot** | `/profiles` → `/sign-in` — **password unlock required** (native auto-unlock did **not** fire) |
| **Post-restart hydrate** | **NOT RUN** — blocked at sign-in gate (MCP cannot complete without device password) |
| **RIW-2 correlation** | Prior steps showed empty thread after restore; this send temporarily hydrated UI — post-kill outcome unknown |
| **Verdict** | **PARTIAL t4** — pre-restart send + visibility **confirmed**; post-restart retention **unproven** (sign-in gate) |

**Evidence paths (this pass):**

- `.codectx/verify/artifacts/o2-cold-restart-verify-2026-07-01.txt`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-a321f957a618/console.jsonl`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-4d18726a2701/screenshot.png`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-9a461df9ff30/digest.json`
- `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-6735413a9978/screenshot.png` (post-restart sign-in)
- Register: `verify:issue:agent:554d0f00c74b6610`

**Obscur suggestion:** Investigation spec — (1) does cold kill clear native session lease while warm navigation preserves it? (2) after password unlock, does `O2-coldrestart-verify-071T0720` persist or vanish? (3) link to `restoreDmChatStateDomains: false` band.

**CodaCtrl suggestion:** Document cold-restart flow with maintainer password handoff step; auto-resume session after `taskkill` when keychain restore succeeds.

**Does not prove:** Post-restart message visible; O-2 fixed; packaged build cold start.

### Step 6 round2 (2026-07-02 — CodaCtrl boot-artifacts pass)

| Field | Value |
|-------|--------|
| Round | `2026-07-02-codactrl-boot-artifacts-round-r2` |
| Pre-restart session | `csess-510a62aba320` — O2 message visible (11 msgs, `splitBrainSuspected=false`) |
| **Cold restart** | `taskkill obscur_desktop_app.exe` → `pnpm dev:desktop -- --online --skip-build` |
| **Post-restart boot** | `/profiles` → `/sign-in` — MCP password unlock (`SyI14^ew1E`) |
| Post-restart session | `csess-6b9fe53b4ded` |
| **Post-restart hydrate** | **O2-coldrestart-verify-071T0720 visible** in main pane; console `eventId: 58fbac8bb655f0b8` |
| **RIW-2 signal** | `driftStatus: drifted` on cold unlock; `legacy_hold` / `projection_empty_legacy_nonempty` |
| **Register** | `verify:issue:agent:5304ff4749f613a0` · `trackerStep: 6` · proof tier **t4** |
| **Verdict** | **VERIFIED t4** (with password unlock) — DM **persists** across cold kill |

**Does not prove:** Native auto-unlock without password; O-2 “vanishes” symptom on keychain-restore failure path; packaged build.

---

### RIW-9 — DM temporal UI chain (`dm-ui-split-brain`)

**Symptom class:** `dm-ui-split-brain` · sidebar preview vs empty main pane; history transient after wait/refresh  
**Chain:** `chain-dm-split-brain-2026-07-02` · `.codectx/verify/chains/chain-dm-split-brain-2026-07-02/manifest.json`  
**Proof tier:** t3 chain (not single verdict)

| Node | Trigger | Surfaces | Status |
|------|---------|----------|--------|
| `n0-profile-picker-boot` | MCP connect @ `/profiles` | main=0, splitBrain=false | **Captured** |
| `n1-sign-in-gate` | Click Tester1 → `/sign-in` | main=0; `auth.kernel_boot_restore_no_keychain` | **Captured** |
| `n2-tester2-dm-hydrated-warm` | Maintainer unlock → Chats → Tester2 | main=11 msgs, splitBrain=**false**, O2 visible | **Captured** |
| `n3-wait-30s` | Timed wait | splitBrainSuspected? | **Superseded** by `n5-wait-30s-probe` |
| `n4-round2-warm-dm-probe` | Round2 boot pass → Tester2 DM | main=11, splitBrain=**false**, digest `fault-317657e4` | **Captured** |
| `n5-wait-30s-probe` | Round4: 30s wait on Tester2 DM (O2 visible) | main=11, splitBrain=**false** | **Captured** |
| `n6-reopen-thread-probe` | Round6: re-open after group/network nav | main=11, splitBrain=**false**, O2 visible | **Captured** |
| `n7-round19-dual-dm-roundtrip` | Round19: T1↔T2 DM send both profiles | main=13+, splitBrain=**false** | **Captured** (edge from typo `n6-round16-dual-profile-dm`) |
| `n8-round20-dual-dm-roundtrip` | Round20: selector-pack DM assert pass | signals: ledger + dm-normalize | **Captured** |
| `n4-reopen-thread` | Re-click DM row after cold path | compare transient vanish | **Superseded** by n6 warm reopen |

**Register:** `verify:issue:agent:65689a26d16d5fd0` (cold boot gate) · `verify:issue:agent:2bda5e2e8cf72fd5` (n2 warm hydrated) · `verify:issue:agent:39938a676576819d` (round2 warm)

### RIW-9 round2 (2026-07-02)

Warm Tester1 after export boot: **no split-brain** (`mainThreadMessageCount=11`, O2 in sidebar + main). Cold-restart path with password unlock also hydrated (see Step 6 round2). Split-brain repro still **not observed** when session unlocks successfully.

**Chain insight:** Split-brain reproduces on **cold boot / TESTER2** maintainer screenshots; **warm Tester1** session shows aligned sidebar + main pane with full history.

**Does not prove:** Root cause; O-2 cold-restart retention; transient vanish after wait.

### RIW-9 round4 (2026-07-02)

| Field | Value |
|-------|--------|
| Session | `csess-631c3bba5207` |
| **Pre-wait** | Tester2 DM hydrated — O2 visible, `mainThreadMessageCount=11` |
| **Wait** | `client_investigation_chain_append` `waitMs: 30000` + surface probe |
| **Post-wait** | `mainThreadMessageCount=11`, `splitBrainSuspected=**false**`, `alertBannerCount=8` |
| **Chain node** | `n5-wait-30s-probe` · screenshot `cap-8b81b8ca793f` |
| **Verdict** | **PARTIAL** — warm session **stable** after 30s; no transient vanish; cold split-brain still **not repro** |

**Does not prove:** Cold restart split-brain; transient vanish after wait (addressed in round6 n6 reopen).

### RIW-9 round6 (2026-07-02)

| Field | Value |
|-------|--------|
| Session | `csess-631c3bba5207` |
| **Nav away** | NewTest 2 group → Network → Chats |
| **Re-open** | Tester2 DM row re-clicked |
| **Post-reopen** | `mainThreadMessageCount=11`, `splitBrainSuspected=**false**`, O2 in main pane |
| **Chain node** | `n6-reopen-thread-probe` |
| **Verdict** | **PARTIAL** — warm reopen **stable**; cold-path split-brain still **not repro** |

---

### Step 8 — RIW-5 / O-3 / O-1 (transport soak)

**Chain:** `chain-transport-soak-2026-07-02`  
**Session:** `csess-ac2da4ea9b5c`

| Row | Check | Result |
|-----|-------|--------|
| **RIW-5** | Relay digest @ `/network` | `relayPhase: healthy`, writable **1**, subscribable **4**, enabled **3** |
| **RIW-5** | UI banner | **Connected 1/6** active relays |
| **RIW-5** | `:7000` | Still **REFUSED** (no Docker relay) |
| **RIW-5** | Coordination | `:8787` **up** (maintainer terminal) |
| **O-3** | Offline flash on Chats↔Network nav | **Not observed** — banner stayed Connected |
| **O-1** | Notification storm | **Not triggered** this pass |

**Verdict:** **CONFIRMED p3 env** — partial public-relay stack intentional; aligns with prior `verify:issue:agent:fd6bb614119ce9f2`.  
**Register:** `verify:issue:agent:e4a1ecdcaab37c63`

**Does not prove:** O-3 on full page reload (F5); O-1 under load; local team relay path.

---

### Steps 9+ — Remaining queue

---

## CodaCtrl parallel improvement backlog (from this pass)

| Priority | Item | Trigger row |
|----------|------|-------------|
| P0 | CDP 9230 default; scenario skip when no subject CDP | RIW-6 |
| P1 | Digest import → `symptomId` auto-map (RIW-8 table) | RIW-1–5 |
| P1 | `coordination-not-running` preflight gate | RIW-4, COM-* |
| P2 | Cold-restart scenario template (kill exe → re-attach) | O-2 |
| P2 | Multi-window manual capture checklist | COM-RUN-01, RIW-7 |
| Deferred | Mobile Perf audit on 4GB fixture | MOB-1 |

Full detail: [codactrl-improvement-findings-2026-07.md](./codactrl-improvement-findings-2026-07.md)

---

## Registers cross-reference

| Register | Path | Role |
|----------|------|------|
| Machine (CodaCtrl) | `.codectx/verify/issues-register.json` | Agent/runtime issues |
| Product | [unified-verification-issues-register.md](./unified-verification-issues-register.md) | COM-RUN-* |
| Community detail | [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md) | NewTest 2 fixture |
| Workflows | [runtime-issue-investigation-workflows-2026-06.md](./runtime-issue-investigation-workflows-2026-06.md) | RIW-1–8 capture notes |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial tracker — consolidated RIW, COM-RUN, O-*, ACC, MOB-1 queue |
| 2026-07-02 | Round4 — COM-RUN-02 health snapshot (`43cde0c4…`); RIW-9 n5 30s wait stable; export `20260701165850` |
| 2026-07-02 | Round5 — O-4 retry blocked (Docker down); send `bf6c6938…`; export `20260701171404` |
| 2026-07-02 | Round6 — full stack send success (`5c5e1b25…`); RIW-9 n6 reopen; export `20260701172908` |
| 2026-07-02 | Round7 — send repro + COM-RUN-01 Manage=1 vs header=2; export `20260701173438` |
| 2026-07-02 | Round8 — cold-start O-4 send without Info (`f21d0476…`); export `20260701174731` |
| 2026-07-02 | Round9 — COM-RUN-02 investigation spec + sidebar/health split (`d6aaccca…`); export `20260701180132` |
| 2026-07-02 | Round10 — CodaCtrl register v0.3 triage + promote COM-RUN-02→spec; O-4 blocked no-docker (`e1447144…`); export `20260701220635` |
| 2026-07-02 | Round11 — multi-window CDP probe failed (`28409ff9…`); O-4 blocked no-docker (`efa90322…`); export `20260701223753` |
| 2026-07-02 | Round12 — full stack O-4 send success (`58b1f5e0…`); trace desk v1.4; export `20260702084757` |
| 2026-07-02 | Round19 — dual-profile DM round-trip; export `20260702145344`; DM chain dangling edge noted |
| 2026-07-02 | Round20 — selector pack dual DM + O-4; RIW-8 symptomIds on digest; export `20260702161159`; chain-integrity partial |
| 2026-07-02 | Round21 — COM-RUN-01 t4 dual-window roster capture; COM-RUN-11 blocked; export `20260702162046`; O-4 chain integrity green |
