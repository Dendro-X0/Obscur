# Obscur experiment reset (2026-05)

**Status:** Active experiment trunk — not a shipping product commitment  
**Completion probability:** Maintainer estimate &lt;50%  
**Success metric:** Cold start → unlock → sidebar interactive without main-thread freeze

---

## Decision

Obscur is no longer pursued as a product milestone sequence. Greenfield is reference-only. This repository continues as a **loadability experiment**: salvage sunk architecture work without another 500M-token greenfield bootstrap.

Broken functionality is acceptable. Unusable startup is not.

---

## Experiment shell

Enabled when:

- `NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL=1`, or
- `NEXT_PUBLIC_DESKTOP_SHELL=1` (desktop dev/build default)

Policy module: `apps/pwa/app/features/runtime/experiment-shell-policy.ts`

| Subsystem | Experiment behavior |
|-----------|---------------------|
| Relay | No WebSocket connections; noop pool; runtime phase `offline` |
| Account projection | Immediate synthetic `ready` — no bootstrap/replay at unlock |
| Account sync | Snapshot `ready`; no rehydrate/backup/restore loops |
| Runtime activation | Fast-path `markRuntimeReady` at unlock; no 12s timeout degrade |
| Groups | Offline stub: hydrate deferred 12s; live bus off. **Online (`EXPERIMENT_ONLINE=1`): immediate hydrate + live bus** |
| Messaging | Offline stub: SQLite/hydrate idle-deferred. **Online: immediate** |
| Navigation | Offline stub: warmup skipped, route guards off. **Online: warmup + guards on** |
| Leave outbox retry | Disabled offline stub only; **enabled when online** |

Deferred work interval: `EXPERIMENT_DEFER_HEAVY_WORK_MS` (12s).

---

## Non-goals

- Public deployable production build
- R1 workspace matrix sign-off
- Relay patch-debug loops
- Greenfield as shipping client
- Feature parity with pre-migration Obscur

---

## Re-enable full shell

Unset experiment mode:

```bash
# Web dev without experiment defaults
cross-env NEXT_PUBLIC_DESKTOP_SHELL=0 NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL=0 pnpm -C apps/pwa dev
```

Desktop Tauri: remove `NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL=1` from `beforeDevCommand` if desktop default is changed.

---

## Next steps (if loadable)

1. Confirm desktop cold start interactive (manual QA).
2. Subtract one parallel owner at a time (transport out of React, staged providers).
3. Re-enable subsystems individually behind explicit flags — not all at once.

See [current-session handoff](../handoffs/current-session.md).
