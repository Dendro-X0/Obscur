# Verify — Contact delete / reconnect + Discovery clear (2026-11-06)

## L1

```bash
pnpm exec vitest run \
  apps/pwa/app/features/account-sync/services/account-event-reducer.test.ts \
  apps/pwa/app/features/messaging/services/contact-request-incoming-lifecycle.test.ts \
  apps/pwa/app/features/messaging/hooks/use-requests-inbox.ts
```

(Add/extend unit coverage for: REMOVED deletes key; canceled onto none no-op; cancel unaccepts; ignore-accepted allows distinct request.)

Targeted pure helpers if extracted from inbox ignore logic.

## L2 (packaged)

1. DemoUser trusted with Tester1 → Remove.
2. DemoUser Discovery → Connect → send invitation succeeds.
3. Tester1 shows pending request (not silent ignore).
4. Discovery → Clear recent searches empties list across reload.

### L2 result 2026-11-07 (static-dev shell)

- Shell: `pnpm dev:desktop -- --rebuild` · `shell-2026-11-07T04:28:28Z` · CDP 9230/9231
- Actors: **Tester1 ↔ Tester2** (DemoUser fixture absent on device; same handshake)
- Evidence: `docs/handoffs/contact-delete-reconnect-l2-soak-2026-11-07.{md,json}`
- **Pass:** Remove · cancel→unaccept (peer Network 0 + Connection removed) · reconnect Invitation delivered · not silent ignore · Clear history
- **Partial:** reconnect Hello landed in existing DM thread; Requests/Invitations tabs stayed empty
- Packaged beta.8 NSIS not re-soaked (stamp not in published build yet)

## Claim language

Pass L1 before "implemented". Pass L2 before "reconnect fixed on device".
L2 2026-11-07 allows: reconnect delivers after Remove on rebuilt static shell. Must not claim DemoUser labels, packaged beta.8, or Soft L3.
