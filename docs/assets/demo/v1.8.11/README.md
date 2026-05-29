# v1.8.11 — Demo / manual verification matrix

**Release:** [v1.8.11-release.md](../../../releases/v1.8.11-release.md)  
**Gate:** [v1.8.11-gate.md](../../../releases/v1.8.11-gate.md)  
**Scope:** [v1.8.11-scope.md](../../../program/v1.8.11-scope.md)

**Prereq:** Managed workspace (Test 8 style) on operator relay — [v1.8.9 demo](../v1.8.9/README.md).

---

## Test B1 — Outbound bot announcement (M11-1) — **new for v1.8.11**

| Step | Actor | Pass criteria |
|------|-------|---------------|
| 1 | Operator | Generate bot nsec; note derived pubkey |
| 2 | Steward (A) | Register bot pubkey in Manage → General → Outbound bots |
| 3 | Operator | `pnpm community-outbound-bot --message "Test announcement"` (see env in [community-outbound-bot.md](../../../messaging/community-outbound-bot.md)) |
| 4 | A + B | Both see bot message in sealed group chat |
| 5 | Operator | Unlisted pubkey publish rejected by client ingest when allowlist active |

**Record:** `run_id`, `outcome=bot_ok|failed`, bot npub suffix, relay URL.

---

## Regression (optional)

- [v1.8.9 Test D1](../v1.8.9/README.md) if relay/gateway filters changed.
- [v1.8.10 Test D2](../v1.8.10/README.md) if compaction path touched.
