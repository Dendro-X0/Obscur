# Conduit Mesh C7 — L3 maintainer soak runbook

**Status:** **PASS** — 2026-07-15 dual-window CDP soak  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c7-client-integration-charter.md](./conduit-mesh-c7-client-integration-charter.md)

---

## Preconditions

| Check | Command / action |
|-------|------------------|
| L1 green | `pnpm verify:conduit-mesh-c7c` |
| Desktop strict kernels | Do **not** set `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1` |
| Mesh default | Do **not** set `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=0` unless testing rollback |
| Coordination (optional) | `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` when testing workspace paths |

Boot:

```bash
pnpm dev:desktop:no-coord -- --rebuild
```

---

## Row A — Settings Conduits panel

| Step | Action | Pass criterion |
|------|--------|----------------|
| A1 | Unlock profile → Settings → Relays | **Conduit transport** panel visible at top |
| A2 | Inspect pool badge | Shows **Conduit Mesh** on desktop default build |
| A3 | Inspect enabled URLs | Each enabled relay shows dialect badge (`Nostr WebSocket` for `wss://`) |
| A4 | E2EE badge | **E2EE on device** visible; metadata honesty copy present |

---

## Row B — Dual-window DM (mesh default)

Two desktop windows (Profile A / Profile B), shared relay overlap.

| Step | Action | Pass criterion |
|------|--------|----------------|
| B1 | A sends DM text to B | Message appears in B thread within 30s |
| B2 | B replies | Message appears in A thread within 30s |
| B3 | Cold focus B window | No duplicate subscription replay storm in console |
| B4 | Settings → Conduits | Enabled relay count matches DM pool |

Evidence: screenshot or CodaCtrl chain id; note relay URLs used.

---

## Row C — Rollback opt-out (optional comparison)

Set `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=0`, rebuild, repeat Row B once.

| Pass criterion |
|----------------|
| Settings shows **Mesh opt-out active** badge |
| DM still works OR documented failure with reason code |

Remove opt-out after comparison.

---

## Failure triage

| Symptom | Likely owner | First check |
|---------|--------------|-------------|
| No subscribe events | `conduit-mesh-nostr-ws-client` | WebSocket open in Conduits list URL |
| Publish OK / no receive | DM subscription manager | Console `dm_subscription.*` logs |
| Panel shows legacy pool | `conduit-mesh-pool-hook-port` | Env opt-out / kernel authority |
| Quorum publish fail | Relay URL health | Try second relay in pool |

---

## Sign-off

```text
C7 L3 — PASS — 2026-07-15 — wss://nos.lol + wss://relay.damus.io — B1 1243ms / B2 1463ms markers C7-L3-ws-20260715D / …D-reply; shell-2026-07-15T13:55:42Z; Settings POOL:CONDUIT_MESH · E2EE ON DEVICE · NOSTR_WS
```
