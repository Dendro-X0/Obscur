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

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| REL-004 leave durability | | |
