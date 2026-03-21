# Issue Status Snapshot (v0.9.4 Release-Candidate Monitoring)

Last updated: 2026-03-21

This file tracks runtime issue status after v0.9.3 plan closure while preparing the v0.9.4 release candidate.

## Current State

- Active release blockers in this file: none.
- Previous v0.9.2 critical incidents are now marked resolved in manual verification and moved to monitoring status.
- Verification source:
  - manual two-device replay + navigation stress replay on dev server,
  - automated reliability/type/docs/release-pack gates passing in this workspace.

## Resolved in Verification (Monitoring)

## 1) Login state persistence regression ("Remember Me" unreliable)

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - remembered-session continuity and restart behavior revalidated across desktop and web paths,
  - mismatch/error paths remain explicit instead of silent session drift.

## 2) Page transition freeze and sidebar interaction lock

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - route transitions remained interactive under replay stress,
  - no unrecoverable sidebar lock/blank-page freeze reproduced in verified runs,
  - route-stall fallback + route-mount diagnostics now provide direct freeze triage evidence when needed.

## 3) Infinite loading loops after identity/profile disruption

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - startup fallback and runtime activation behavior remained recoverable in validation scenarios,
  - no persistent infinite-loading loop reproduced in the verified runs.

## 4) Cross-device DM history regression (self-authored messages missing)

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - targeted two-device restore replay preserved self-authored DM history in validated conversations,
  - backup hydration/restore merge diagnostics now expose stronger evidence paths for future triage.

## 5) Media history hydration mismatch (desktop vs web)

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - historical media presence was revalidated in the tested restore/sync scenarios,
  - desktop/web parity held in the verified replay set.

## 6) Group/community state inconsistencies under sync churn

- Status: Resolved in dev-server verification; Monitoring.
- Resolution snapshot:
  - membership visibility and sendability remained converged in verified cross-device flows,
  - prior room-key/membership drift symptoms were not reproduced in acceptance runs.

## Monitoring Guardrails

1. Keep two-device replay as required evidence for any future claim of regression fix.
2. Preserve canonical owner boundaries (startup owner, relay owner, account-sync owner).
3. Treat route-mount and M0 triage captures as first-response diagnostics for new freeze reports.
4. Promote issues back to "Active blocker" immediately if reproduced in release-candidate or production telemetry.
