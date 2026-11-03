# v1.8.6 demo matrix

| ID | Scenario | Tester 1 | Tester 2 | Pass |
|----|----------|----------|----------|------|
| M6-1 | Invite sent from community page appears in inviter DM | ☑ | ☑ | ☑ |
| M6-2 | Recipient accepts; inviter sees acceptance status in DM | ☑ | ☑ | ☑ |
| M6-3 | Relay join after accept reaches terminal explicit state (joined/retry/failed) | ☐ | ☐ | ☐ |
| M6-4 | Participants/network membership surfaces stay consistent with read-model owner | ☐ | ☐ | ☐ |

## Current release evidence (2026-05-27)

- Automated gates are green on maintainer machine:
  - `pnpm release:test-pack -- --skip-preflight` passed.
  - `pnpm docs:check` passed.
- Manual relay-backed group chat validation is **environment-blocked** in local host loopback setup.
- Release decision for v1.8.6 should treat M6-3/M6-4 as pending staging evidence, not as unresolved logic regressions.

## M6-3 soak log (2026-05-27)

- Outcome: **Blocked by environment wiring**, not invite acceptance logic.
- Observed states:
  - Accept path reaches **Acceptance recorded** (DM response publish succeeds).
  - Relay join retries can end in **terminal_failed** with `wss://localhost:7000`.
  - Some runs show **No writable relays connected** despite local relay process being up.
- Infra spot checks on maintainer machine:
  - `http://127.0.0.1:8787/health` returns `{"ok":true,...}`.
  - Relay container is up and `http://127.0.0.1:7000/` responds.

### M6-3 rerun procedure (local)

1. Keep all three processes running in separate terminals:
   - `pnpm -C apps/coordination dev`
   - `pnpm dev:relay`
   - `pnpm dev:desktop:online`
2. In both clients, open Settings -> Relays and ensure workspace relay is exactly `ws://localhost:7000` (not `wss://localhost:7000`).
3. Refresh relay status, ensure relay is connected/writable, then restart both desktop windows.
4. Create a fresh invite (do not reuse prior failed card state), accept on Tester2, then click **Complete join on relay**.
5. Record one of the terminal explicit outcomes:
   - `joined` (preferred pass), or
   - `retry_scheduled` -> manual retry -> `terminal_failed` with explicit relay URL/message.
6. If local still fails due to relay wiring (`No writable relays connected`, `wss://localhost` mismatch, coordination 502), mark as **Blocked (Environment)** and capture screenshot/log evidence.

### M6-3/M6-4 staging unblock plan

1. Run relay and coordination on staging/VPS with public endpoints.
2. Point both clients at the same staging relay/coordinator.
3. Execute invite -> accept -> relay join -> send message.
4. Mark M6-3 pass when terminal state is explicit and deterministic.
5. Mark M6-4 pass when participants modal, network card count, and chat header count agree on both A and B.

