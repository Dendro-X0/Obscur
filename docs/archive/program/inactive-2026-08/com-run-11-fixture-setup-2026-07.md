# COM-RUN-11 fixture setup — fresh invite charter

**Status:** Active — maintainer + CodaCtrl operator procedure  
**Date:** 2026-07-02 (UTC)  
**Issue:** COM-RUN-11 · Invite UX role collapse (both profiles see Cancel)  
**Proof tier required:** **t4** (Tester1 + Tester2 native windows, live invite card)  
**Prerequisite investigation:** [`specs/backend/groups-ledger-validation-investigation-2026-07.md`](../../specs/backend/groups-ledger-validation-investigation-2026-07.md)

---

## Why purge is required

Round 21 confirmed COM-RUN-11 is **blocked** on the current fixture:

- Tester2 DM thread contains **5+ historical NewTest 2 invite cards** (superseded / expired / canceled terminal states)
- Tester2 **Group sidebar is empty** — no joinable community row
- Tester1 roster shows **Tester1 only** in participants modal
- Ledger: **18/20 invalid entries** on Tester1; migration logged but never applied

A live Accept/Cancel matrix **cannot** be exercised until historical invite state is cleared and a **new invite** is sent on a clean ledger/coordination baseline.

---

## Fixture target state (post-setup)

| Actor | Expected state |
|-------|----------------|
| **Tester1** | NewTest 2 in Group sidebar; Info → Participants shows **Tester1 + Tester2** (or invite pending with both pubkeys in evidence) |
| **Tester2** | Live invite card in DM **or** Group sidebar row with **Accept / Decline** (not Cancel-only) |
| **COM-RUN-11 pass** | Inviter sees **Cancel**; invitee sees **Accept + Decline** on the **same active inviteId** |
| **Ledger** | `invalidEntries: 0` (or ≤1 documented archive) after unlock digest |

Community constants (unchanged):

| Field | Value |
|-------|--------|
| Display name | NewTest 2 |
| Relay | `ws://localhost:7000` |
| Mode | `managed_workspace` |
| Legacy groupId (historical) | `b93f53e23d8c4456835afd3f4d3a627b` |

After purge + recreate, groupId may differ — record new id in round export notes.

---

## Phase 0 — Stack preflight

```bash
pnpm dev:relay:docker          # :7000
pnpm dev:coordination          # :8787
```

CodaCtrl: `client_stack_preflight { requireDualWindow: true }` → all green.

---

## Phase 1 — Quit desktop

Close **all** Obscur windows (File → Exit). Verify no lock holders:

```bash
# Windows — optional check
tasklist | grep -i obscur
```

Playwright purge and `--nuclear` fail if WebView profile is locked.

---

## Phase 2 — Purge NewTest communities (both profiles)

From repo root:

```bash
# Tester1 (default profile)
pnpm purge:workspace -- --match NewTest

# Tester2 (profile slot 2)
pnpm purge:workspace -- --match NewTest --profile profile-2
```

**Windows harness note (2026-07-02):** First run cleared coordination D1 successfully; Playwright localStorage step hung >7 min. Fallback: kill stuck node process, then delete EBWebView manually (coordination already purged):

```bash
rm -rf "$APPDATA/app.obscur.desktop/profiles/default/EBWebView"
rm -rf "$APPDATA/app.obscur.desktop/profiles/profile-2/EBWebView"
```

**Executed 2026-07-02:** D1 purged + both profile EBWebView dirs removed. Desktop must cold-restart before Phase 4 recreate.

**What this clears:**

- Coordination D1 membership directory (`purge-membership-directory.sql`)
- localStorage: chat state groups, membership ledger keys, room keys, known participants, tombstones (match filter `NewTest`)

**If selective purge fails:**

```bash
pnpm purge:workspace -- --match NewTest --profile default --nuclear
pnpm purge:workspace -- --match NewTest --profile profile-2 --nuclear
```

Nuclear removes entire EBWebView for the profile — requires re-import or profile picker setup.

---

## Phase 3 — Cold restart desktop

```bash
pnpm dev:desktop -- --online --skip-build
```

Dual CDP: `:9230` main, `:9231` after `openProfileSlot(2)`.

Unlock both profiles ([`obscur-dev-test-accounts.md`](./obscur-dev-test-accounts.md)).

**Baseline capture (CodaCtrl round 22a):**

1. `client_runtime_digest_pull` both sessions → assert `groups-ledger-validation` absent or `invalidEntries: 0`
2. Confirm Group sidebar **empty** on both (expected post-purge)

---

## Phase 4 — Recreate NewTest 2 (Tester1)

Maintainer manual path (COM-MEM-2 steps 3–4):

1. Tester1 → **Group** → **New Group** / managed workspace create
2. Name: `NewTest 2` · relay `ws://localhost:7000`
3. Complete create flow until community appears in sidebar
4. Open **Info** → verify membership health `ready:1`, no `room_key_missing`
5. Record new `groupId` + `communityId` in export notes

**CodaCtrl selectors (v1.1 pack + explicit):**

- Group tab: `button:has-text("Group")`
- Community row: `role=button[name*="NewTest 2"]`
- Info: `role=button[name="Info"]`

---

## Phase 5 — Fresh invite (Tester1 → Tester2)

1. NewTest 2 → **Invite** (or Manage → invite flow)
2. Select **Tester2** as invitee
3. Send invite — note **inviteId** / DM card timestamp prefix: `COM-RUN-11-round22-*`

**Do not** reuse historical DM invite cards from prior rounds.

---

## Phase 6 — COM-RUN-11 verification matrix (t4)

| Window | Action | Pass |
|--------|--------|------|
| T1 `:9230` | Open live invite card / pending invite surface | Shows **Cancel** (inviter) |
| T2 `:9231` | Open same invite in DM or Requests | Shows **Accept** + **Decline** (invitee) |
| Both | `client_validate_assert` textVisible for role-specific buttons | pass |
| Both | Screenshot + chain append `n28-round22-com-run11-live-invite` | captured |

**Fail examples (known bugs):**

- Both show Cancel → COM-RUN-11 confirmed regression
- Invitee sees nothing → COM-RUN-01 / join path / ledger still broken
- Card terminal immediately → invite superseded — fixture timing; retry with new inviteId

---

## Phase 7 — CodaCtrl export

```text
roundLabel: 2026-07-02-codactrl-round22
notes: COM-RUN-11 fixture setup + live invite matrix; post-purge ledger baseline
doesNotProve: Production relay; packaged build; COM-MEM-2 cold restart
```

Assert:

- `export-bundle-coherence.json` → `coherent: true`
- `chain-o4-group-ingest` node for COM-RUN-11 with `transportEvidence`
- Register row `symptomId: COM-RUN-11` status `triaged` or `confirmed`

---

## CodaCtrl scenario template (proposed)

Id: `scenario.com-run-11-fresh-invite@1`

| Step | Tool | Notes |
|------|------|-------|
| 0 | `client_stack_preflight` | requireDualWindow |
| 1 | Maintainer purge (external) | documented gate |
| 2 | `client_session_connect` ×2 | :9230 + :9231 |
| 3 | digest pull | ledger baseline |
| 4–6 | manual create + invite | maintainer until automate create exists |
| 7 | dual assert + `client_multiwindow_capture` | role matrix |
| 8 | `verify_issues_report_export` | round label |

---

## Rollback

If recreate fails mid-flight:

1. Re-run Phase 2 purge
2. Restore from last good pass archive under `.codectx/verify/passes/2026-07-02/`
3. Document blocker in tracker §Step 5 — do not patch invite UI until ledger baseline clean

---

## Cross-links

- [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md) COM-RUN-11
- [community-invite-role-ecosystem-design.md](./community-invite-role-ecosystem-design.md)
- [obscur-runtime-issue-tracker-2026-07.md](./obscur-runtime-issue-tracker-2026-07.md) §Step 5 round21
