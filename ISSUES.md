# Confirmed Issues (v0.9.2 Release Constraint Snapshot)

Last updated: 2026-03-20

This file records only runtime-confirmed issues that remain open for post-v0.9.2 recovery work.

## Release Reality

- v0.9.2 is being shipped with known degradations due timeline pressure.
- Reverting behavior toward v0.9.1 is currently treated as an improvement in some flows.
- New fixes have repeatedly resurfaced old failures; this document is the canonical incident baseline for future iterations.

## 1) Login state persistence regression ("Remember Me" unreliable)

- Status: Confirmed, unresolved in runtime confidence terms.
- Severity: Critical (session trust and user retention).
- Symptoms:
  - Users are asked to log in again after restart.
  - Some sessions behave like one-time credentials and fail after restart.
  - Startup may stall in profile-binding/auth transitions before reaching a stable unlocked session.
- Scope:
  - Web and desktop, especially after recent startup warm-up/runtime changes.

## 2) Page transition freeze and sidebar interaction lock

- Status: Confirmed, unresolved.
- Severity: Critical (unrecoverable UX failure).
- Symptoms:
  - App can freeze during page switches, especially near first chat/community navigation.
  - Sidebar becomes unclickable after several route switches.
  - In some cases F5/reload does not recover; full process restart is required.
- Suspected contributors:
  - Runtime/relay churn plus UI layering/transition ownership conflicts under load.

## 3) Infinite loading loops after identity/profile disruption

- Status: Confirmed, unresolved.
- Severity: Critical (app unusable).
- Symptoms:
  - Web can enter infinite loading loops.
  - Desktop can enter infinite loading after identity/account switching mistakes (for example key/account mismatch scenarios) and fail to recover cleanly.
- Notes:
  - This remains a major release risk and triage priority.

## 4) Cross-device DM history regression (self-authored messages missing again)

- Status: Confirmed recurring regression.
- Severity: High (data trust and continuity).
- Symptoms:
  - After new-device login/sync, peer messages may appear while self-authored historical messages are missing.
  - Issue can reappear after startup/sync pipeline changes even when previously improved.
- Notes:
  - This is a repeated architecture-level instability, not a one-off bug.

## 5) Media history hydration mismatch (desktop vs web)

- Status: Confirmed, unresolved.
- Severity: High (history completeness).
- Symptoms:
  - Historical images/videos/audio/files can disappear after restore/login.
  - Desktop may fail to load historical media that still appears on web for the same account state.

## 6) Group/community state inconsistencies under sync churn

- Status: Partially improved but still fragile.
- Severity: High.
- Symptoms:
  - Prior states included "room key missing" send-block and membership visibility drift.
  - Some send-path issues were mitigated, but related cross-device/state convergence remains sensitive to iteration changes.

## Next Iteration Guardrails

1. Treat this file as release truth, not as a backlog wish list.
2. No "fixed" claim without two-device runtime verification.
3. Preserve canonical owner boundaries; avoid adding parallel lifecycle owners.
4. Any startup/relay/auth change must include explicit rollback criteria.
