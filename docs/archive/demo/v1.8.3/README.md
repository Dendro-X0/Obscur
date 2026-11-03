# v1.8.3 — REL-004 leave durability

**Release band:** **v1.8.3**  
**Environment:** [verification-environment.md](../verification-environment.md) — Tester 1 (dark) + Tester 2 (light)

**Setup tip:** Use a community on a relay you can temporarily block (or disconnect network) to force outbox `pending` / `rate_limited` without undoing local leave.

---

## T-REL-004 — Leave outbox

| ID | Step | Expected | Pass |
|----|------|----------|------|
| T4-1 | Leave from group home → confirm | Community drops from Network/groups immediately; ledger left | ☐ |
| T4-2 | Block relay / go offline → leave another test community | Still leaves locally; outbox item pending (no rollback to joined) | ☐ |
| T4-3 | Restore relay / wait for retry | Pending clears or shows honest rejected copy; no ghost re-join | ☐ |
| T4-4 | Settings bulk-leave (if used) | Same durable behavior as single leave | ☐ |
| T4-5 | Reload app after T4-2 | Left communities stay gone; pending outbox retries on activation | ☐ |

---

## Optional soak (not blocking REL-004 tag)

| ID | Step | Expected | Pass |
|----|------|----------|------|
| DM-INV-1 | Tester1 sends community invite to Tester2 in DM | Outgoing invite card on A; pending / superseded states visible | ☑ 2026-05-27 |
| DM-INV-2 | Tester2 accepts in DM | A thread shows **Acceptance recorded** | ☑ 2026-05-27 |

Relay join / group sidebar entry — defer to [v1.8.4 demo](../v1.8.4/README.md).

---

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| REL-004 leave durability | | T4-1…T4-5 required before tag |
