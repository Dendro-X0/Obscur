# Single-door FM1 L3 soak
- Captured: 2026-11-02T10:37:18.119Z
- Verdict: **Pass**
- CDP: `http://127.0.0.1:9230`
## Matrix
- sessionInactiveAfterLock: true
- lockReturnsToGate: false
- passwordOnlyReentryShell: true
- s5L2Only: true
## Non-claims
- Soft L3 Fixed
- Tor Verified
- S5 L3 dual-profile FS soak
## Notes
- Rebuild included FM1-L3 hydrate_suppressed latch (SessionState + SessionApi manual-lock skip).
- Pass requires session inactive after Lock AND password reentry to messenger shell.