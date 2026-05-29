# v1.8.8 demo matrix

| ID | Scenario | Tester 1 | Tester 2 | Pass |
|----|----------|----------|----------|------|
| M8-1 | v1.8.7 transport/read-model behavior remains stable on 1.8.8 baseline | ☑ | ☑ | ☑ |
| M8-2 | Managed workspace: create → invite → accept → sealed group chat (Test 8) | ☑ | ☑ | ☑ |
| M8-3 | CI gates remain green (`docs:check`, `release:test-pack`, workflow checks) | ☑ | ☑ | ☑ |

## Current release evidence (2026-05-29)

- Version bumped to `1.8.8` across tracked packages.
- **Test 8 passed** — two-client managed-workspace run on local infra (maintainer session):
  - A creates community **Test 8** → invite → B accepts → relay join → both in sealed group chat.
  - Messages exchanged (`test`); history survives restart on both clients after persistence hydration fix.
  - Chat header shows **members · online · last activity** under group title.
  - B leave: participants modal shows **LEFT** / excluded roster; A header member count updates (may lag briefly on widen-only projection — known limitation).
- T8-1 automated carry-forward green:
  - `pnpm version:check`
  - `pnpm docs:check`
  - `pnpm release:test-pack -- --skip-preflight`
- Post-release roadmap documented: [v1.8.9+ managed workspace](../../../program/v1.8.9-plus-managed-workspace-roadmap.md) (operator-relay deletion, group bots).

### M8-2 outcome record

```text
run_id=test8-2026-05-29 outcome=joined notes=coordination:8787 relay:ws://localhost:7000 both clients sealed chat + restart history
blocker=none
```

---

## M8-2 manual unblock packet

### Purpose

Provide a reproducible, auditable manual lane for invite → accept → relay join → sealed chat verification without overstating parity when the environment is unstable.

### Environment prerequisites

1. Start required services (separate terminals):
   - `pnpm -C apps/coordination dev`
   - `pnpm dev:relay:docker` (or `pnpm dev:relay` when Docker is available)
   - `pnpm dev:desktop:online`
2. Validate local infra health before client actions:
   - Coordination: `http://127.0.0.1:8787/health` returns `ok: true`.
   - Relay: `http://127.0.0.1:7000/` responds.
3. **Relay whitelist:** `infra/nostr/nostr-rs-relay.toml` must not block all pubkeys (empty `pubkey_whitelist` blocks everything on `nostr-rs-relay`).
4. In both clients, ensure workspace relay is exactly `ws://localhost:7000`.
5. `apps/pwa/.env.local`: `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` (and coordination-only workspace flag if used).
6. Use fresh invite cards (do not reuse cards from prior failed attempts).

### Manual run procedure (A/B)

1. Tester A creates/sends community invite to Tester B.
2. Tester B accepts invite in DM.
3. Tester B triggers **Complete join on relay** when shown.
4. Record terminal state observed on B:
   - `joined`, or
   - `retry_scheduled` followed by retry outcome, or
   - `terminal_failed` (with explicit message).
5. Exchange at least one sealed group message each way.
6. **Restart both apps** and reopen Test 8 chat — confirm history hydrates from local store.
7. Verify membership consistency on both clients:
   - participants modal roster,
   - network card member count,
   - chat header (members · online · last activity),
   - invite dialog membership gating behavior.
8. Optional leave test: B leaves → A sees B as LEFT in participants; A header trends to **1 member** (allow brief lag).
9. Capture artifacts listed below.

### Required evidence artifacts per run

- Screenshot: Tester A membership surfaces after B accept/join attempt.
- Screenshot: Tester B relay join terminal state and membership surfaces.
- Screenshot: chat header with member/online/activity line.
- Screenshot: chat history after restart (both clients).
- Log excerpt: relay join status/copy shown to user.
- Log excerpt: relay + coordination health checks at run start.
- Outcome summary line using template:
  - `run_id=<id> outcome=<joined|retry_scheduled|terminal_failed|blocked_environment> notes=<short text>`

### Blocker classification (required)

When run does not pass, classify exactly one primary blocker:

- `blocked_environment` — infra wiring, relay connectivity, coordination unreachable, localhost mismatch, relay whitelist blocking publish.
- `blocked_transport` — deterministic transport behavior regression in code path.
- `blocked_ui_consistency` — surface mismatch across header/network/participants/invite.

Use this report row format:

`blocker=<class> signal=<exact error or mismatch> reproduction=<steps> mitigation=<next action>`

### Pass criteria for M8-2

- At least one complete A/B run with full artifacts and blocker classification.
- If blocked, blocker report is complete and actionable (not generic).
- If passing, terminal relay-join state, sealed chat, restart history, and membership surfaces are consistent across both clients (header count may lag briefly — document if observed).

---

## Post–v1.8.8 (not blocking this tag)

| Enhancement | Doc |
|-------------|-----|
| End-to-end deletion on operator relay | [v1.8.9+ roadmap](../../../program/v1.8.9-plus-managed-workspace-roadmap.md) § Theme 1 |
| Group bots (Telegram/Discord-style) | [v1.8.9+ roadmap](../../../program/v1.8.9-plus-managed-workspace-roadmap.md) § Theme 2 |
