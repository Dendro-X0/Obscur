# Current Session Handoff — Obscur (native-first)

- Last Updated (UTC): 2026-06-02T01:00:00Z
- Session Status: **Active — STAB-R (render-loop systemic program)**
- Git SHA: `0105f406` + uncommitted

## North star (read first)

**[ui-render-loop-systemic-program.md](../program/ui-render-loop-systemic-program.md)** — why crashes recur, why desktop = mobile, what “comprehensive fix” means.

Manual Phase B matrix **paused** until STAB-R bands R1–R3 exit. No more loop-hunting via maintainer clicks.

---

## STAB-R progress (uncommitted)

| Band | Change | Status |
|------|--------|--------|
| **R1** | Remove `syncRelayRuntime` from `relay-provider` + `experiment-relay-shell` | **Done** |
| **R1** | CI forbid `syncRelayRuntime` in relay providers | **Done** |
| **R2** | CI forbid `runtime.snapshot.relayRuntime` in effect deps | **Done** |
| **R2** | CI forbid hintsSignature auto-reconcile | **Done** (prior) |
| **R3** | Activation once-per-cycle + transitionTo dedup | **Done** (STAB-4) |
| **R-smoke** | Headless STAB-R1/R3 tests wired into `verify:stability` | **Done** |

Also uncommitted: STAB-1–3, P4-5 docs, `useShellTransportReady` in relay provider.

---

## Automated gate (substitute for manual loop testing)

```bash
pnpm verify:stability
```

Must pass before any handoff claims “launch stable”. **STAB-R exit met** when this gate is green on landed SHA.

---

## Next atomic step

1. Land uncommitted STAB-R + STAB-1–3 + docs on one commit.
2. Resume **product** verification rows (DM/community) via matrix §2–§3 when needed — not loop hunting.
