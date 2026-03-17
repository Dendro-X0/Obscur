# Confirmed Issues (v0.9.0-beta Track)

Last updated: 2026-03-16

This file lists only issues currently confirmed in runtime testing.

## 1) Web account restore drops self-sent DM history (Long-standing, unresolved)
- Status: Confirmed, unresolved, documented for user awareness.
- Severity: High (data completeness / trust impact).
- Affected flow:
  - Login/import account on a new web device/session.
  - Profile/contact metadata restores, but direct-message history is incomplete.
  - Messages received from peers appear; messages previously sent by the account owner are missing from restored DM history.
- Notes:
  - This remains an active architectural gap in cross-device DM replay/ownership reconciliation.
  - Treat this as a known limitation until a dedicated replay model is introduced.

## 2) Password portability across devices (Active, mitigated)
- Status: Confirmed; mitigation landed, still monitored.
- Severity: High (cross-device auth reliability).
- Root cause summary:
  - Username/password unlock is local-state based (decrypts local stored identity record).
  - Password encryption material did not always converge quickly enough across devices.
  - Restore merge logic could preserve local password material and block remote convergence.
- Landed mitigation:
  - Backup payload now carries portable identity unlock snapshot (`identityUnlock`).
  - Restore merge now prefers incoming password-based unlock material for convergence.
  - Passwordless incoming snapshots never overwrite an existing password-based local snapshot.
  - Password reset/change now emits an account-sync mutation signal to trigger backup publish quickly.
- Remaining constraints:
  - Fresh devices still require one-time private-key import to establish local identity before username/password unlock can work locally.
  - Relay instability/degraded restore windows can delay convergence.

## 3) Runtime performance degradation/freezes under sustained load
- Status: Confirmed, under active investigation.
- Severity: High (usability).
- Symptoms:
  - Desktop can freeze when switching pages from the sidebar.
  - Web can stall during startup/login (blank/loading state for extended periods).
  - Long-running sessions degrade responsiveness on low-spec hardware.
- Notes:
  - Likely multi-factor (relay churn, activation retries, heavy hydration, render pressure).
  - Continue prioritizing runtime lifecycle simplification and relay resilience gates before feature expansion.
