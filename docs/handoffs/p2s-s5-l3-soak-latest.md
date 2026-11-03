# P2-S S5 dual-profile quarantine FS L3 soak
- Captured: 2026-11-02T11:35:00.732Z
- Verdict: **Pass**
- CDP: `http://127.0.0.1:9230`
## Matrix
- aliceWrite: true
- aliceRead: true
- bobCrossRead: true
- bobRawFsStillPresent: true
## Non-claims
- Soft L3 Fixed
- Tor Verified
- Matrix promote
- OS ACL multi-user isolation
## Notes
- Product gate mirrors `readInboundMediaQuarantineBytes` path membership (Storage plane).
- Raw FS presence under Alice path is honesty only — isolation is API fail-closed, not OS ACL.