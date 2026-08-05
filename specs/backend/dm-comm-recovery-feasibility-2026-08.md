# Feasibility — DM communication recovery (stop patch loop)

**Date (UTC):** 2026-08-05  
**Status:** Feasibility gate triggered (≥3 substantial iterations; no L3 recovery)  
**Handoff conflict:** Maintainer concludes “rewrite only”; evidence shows **restore-from-HEAD is still available**.

```text
NEXT ATOMIC STEP:     Mesh reconnect re-dials WS (open=0 residual) — STOP further patches
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      dm-send-pipeline · use-conduit-mesh-relay-pool · conduit-mesh-nostr-ws-client
PROOF BEFORE DONE:    L3 desktop: send OK after recovery choice (restore or thin rewrite charter)
OUT OF SCOPE:         Full messaging rewrite · Soft L3 Docker SLA · AUTH-SESSION · groups/** · video
```

## Evidence

1. Relays UI previously: `Publish-ready 2 · Open sockets 0` → delivery toast.
2. After reconnect patches: cards show APP RTT on primal/nos (sockets can open), but send still fails; desktop log shows **NativeRelay `connect_relay` storm** (repeated dials) — consistent with warm `forceReconnectAll` thrashing open sockets / OK waiters.
3. Local `ws://localhost:7000` `websocket_error` + stack log: Docker relay failed to start — expected when Docker relay is required but not running; **not** the only path (public Nostr still configured).
4. Ghost CALL COMPLETED 0:30 — separate honesty bug (sqlite/`ended`); not proof that transport must be rewritten.

## Why “no revert” is incorrect

Working tree has **uncommitted** diffs vs `HEAD` (`de421bea`).  
`relay-network-warmup.ts` is **untracked** (not in git).  
Committed `HEAD` `dm-send-pipeline` still uses Phase-1 `sendToOpen` always and has **no** warm/force-reconnect layer.

Restore does **not** require a past “working” commit from the maintainer — only:

```bash
git restore -- <paths>
# and delete untracked warm module if restoring send path
```

## Outcomes (rules/11 — pick one)

### A — Surgical restore (recommended first)

Restore last committed send/transport owners; drop reconnect-storm patches. Keep optional UI-only notification files if desired.

**Restore set (minimum):**

- `apps/pwa/app/features/messaging/controllers/v2/dm-send-pipeline.ts` (+ test)
- `apps/pwa/app/features/messaging/controllers/v2/dm-send-with-retry.ts`
- `apps/pwa/app/features/messaging/controllers/v2/dm-controller-types.ts`
- `apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts`
- `apps/pwa/app/features/transport-kernel/conduit-mesh-nostr-ws-client.ts` (+ test)
- Delete untracked: `relay-network-warmup.ts` (+ test)

**Then:** rebuild desktop shell; L3 send A↔B.

### B — Thin rewrite (only if A fails L3)

Not a greenfield messenger. Charter a single publish owner:

1. One dial policy (no warm+supervisor+settings triple reconnect).
2. One EVENT + OK waiter (no dual Phase-1/Phase-2).
3. Ready = open socket count > 0 only at publish boundary.
4. Explicit product copy when open stays 0 (no false “confirmed”).

Spec + subtraction first; no code until charter approved.

### C — Infeasible under current constraints

Only if A and B both fail with evidence that public Nostr + NativeRelay cannot complete OK under maintainer network. Then pause DM online goal; keep local-only honesty.

## Decision (maintainer 2026-08-05)

Chose **B-variant**: thin DM send refactor with **Rust retained**; **no** wholesale tree restore (preserve unrelated UI).  
CodaCtrl MRI=`remediate`, RWR mode=`refactor`.  

Charter: [dm-send-thin-refactor-investigation-2026-08.md](./dm-send-thin-refactor-investigation-2026-08.md) · [dm-send-thin-refactor-design-2026-08.md](./dm-send-thin-refactor-design-2026-08.md).
