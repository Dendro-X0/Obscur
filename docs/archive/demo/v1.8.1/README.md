# v1.8.1 — Phase 4.1 mode-aware create

**Release band:** **v1.8.1**  
**Environment:** [verification-environment.md](../verification-environment.md) — Tester 1 (dark) + Tester 2 (light)

---

## C-4.1 — Create flow

| ID | Step | Expected | Pass |
|----|------|----------|------|
| C4-1 | Settings → only public relays → Create → Managed Workspace | Managed card disabled or create blocked with honest copy | ☐ |
| C4-2 | Enable private/trusted relay → Create Managed | Community created; management shows managed mode + steward | ☐ |
| C4-3 | Create Sovereign on public relays | Succeeds; no managed gate on home | ☐ |
| C4-4 | Refresh after create (A and B) | `communityMode` unchanged; human name visible | ☐ |

---

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| C-4.1 create | 2026-05-22 | Maintainer sign-off; no client console errors reported |
