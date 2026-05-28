# v1.8.7 demo matrix

| ID | Scenario | Tester 1 | Tester 2 | Pass |
|----|----------|----------|----------|------|
| M7-1 | Relay-join terminal outcomes match deterministic contract copy (`joined` / `retry_scheduled` / `terminal_failed`) | ☐ | ☐ | ☐ |
| M7-2 | Membership count and roster are consistent across chat header, participants modal, network card, invite dialog | ☐ | ☐ | ☐ |
| M7-3 | CI relay smoke + release reliability gates are green for current head | ☐ | ☐ | ☐ |

## Current release evidence (2026-05-28)

- `reliability-gates` is green on `main`, including `relay runtime smoke`.
- `v1.8.6` release has been published.
- `main` version has been bumped to `1.8.7`.
- Manual relay-backed two-client soak remains environment-sensitive and must be recorded explicitly when not reproduced.
- T7 automated evidence now includes:
  - `app/features/groups/services/community-invite-relay-join.test.ts`
  - `app/features/network/components/invite-to-group-dialog.test.tsx`
  - `app/features/network/components/network-dashboard.test.tsx`
  - `app/features/messaging/components/chat-view.test.tsx`
- M7-3 status: **Automated CI pass confirmed** (manual tester cells remain for optional human reruns).

