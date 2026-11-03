# v1.8.4 — Invite evidence + membership read-model

**Release band:** **v1.8.4**  
**Environment:** [verification-environment.md](../verification-environment.md) — Tester 1 (dark) + Tester 2 (light)

---

## M4 — Invite response and read-model matrix

| ID | Step | Expected | Pass |
|----|------|----------|------|
| M4-1 | Tester1 sends community invite to Tester2 | Tester1 DM thread shows outgoing invite card (pending/cancel) after reopen/restart | ☐ |
| M4-2 | Tester2 accepts invite while community relay publish is degraded | Tester2 sees honest relay toast; Tester1 still receives DM invite-response | ☐ |
| M4-3 | Tester1 opens DM thread with Tester2 | Invite status resolves to accepted (or terminal response) with no duplicate cards | ☐ |
| M4-4 | Open participants/network membership surfaces | Membership list uses consistent read owner; no discovery-only ghost member in membership actions | ☐ |
| M4-5 | Decline/cancel path | Status updates to declined/canceled without resurrecting membership | ☐ |

---

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| v1.8.4 invite + read-model | | |
