# Investigation — DM send error chain (CodaCtrl + codegraph)

**Date (UTC):** 2026-08-05  
**Status:** Confirmed — thin refactor charter (not full-tree restore, not greenfield rewrite)  
**Maintainer goal:** Restore DM send while keeping unrelated UI work; keep Rust NativeRelay; start from CodaCtrl error chain.

```text
NEXT ATOMIC STEP:     DM thin refactor charter (Rust retained) — Phase 0 CodaCtrl complete
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      dm-send-pipeline → dm-relay-transport → use-conduit-mesh-relay-pool → conduit-mesh-nostr-ws-client → NativeRelay → apps/desktop/src-tauri/src/relay.rs
PROOF BEFORE DONE:    L1 pipeline/transport · L2 cargo check desktop relay · L3 parity-desktop A↔B send
OUT OF SCOPE:         Full messenger rewrite · groups/** writers · AUTH-SESSION · Soft L3 Docker SLA · video
```

## CodaCtrl evidence (this session)

| Tool | Result |
|------|--------|
| `studio_pathway` | Subject next step = DM recovery; frozen pkgs include `@obscur/conduit-mesh*`; paused COM-RUN/O-2/O-4 |
| `studio_maintenance_intake` (MRI) | Verdict **`remediate`** (not `rewrite_candidate`) — surgical, not big-bang |
| `studio_rewrite_standards` (RWR) | Mode **`refactor`**; keep prove-over-CI; Design ZIP absent (`claimExportAllowed=false`) |
| `studio_map_hop` on `dm-send-pipeline.ts` | Imports: types · receive · **dm-relay-transport** · **relay-network-warmup** |
| `studio_map_trail` pin | 7-node trail stored `.codectx/explore/neural-trail.json` |
| `studio_owner_conflicts_get` | Dual-owner **`relay-publish`** (21 writers incl. groups + mesh pool). **Do not add writers in `groups/**` (PAUSED).** DM keep set = mesh pool + WS client + Rust relay |
| `verify_truth_surface_evaluate` | Claim “DM delivery confirmed…” bound to **`parity-desktop`** (shipSurface, not Dev Lab) |
| `verify_shell_freshness_evaluate` | Pass — shell stamp ≥ source (rebuild still required after later mutate) |
| Issue rollup (stale Jul-30 hub) | Community/COM-RUN heavy — **not** this residual; do not drive DM fix from O-4 chains |

## Causal chain (one user action: Send DM)

```text
Composer send
  → sendDmMessage (dm-send-pipeline)
      → [regression] warmRelayNetworkForSend → pool.reconnectAll({force}) → forceReconnectAll
      → publishToRelays (dm-relay-transport)
          → pool.publishToUrls / publishToAll
              → use-conduit-mesh-relay-pool → runtime.publishToUrls
                  → conduit-mesh-nostr-ws-client.publish (wait OK on socket)
                      → createRelayWebSocket → NativeRelay (TS)
                          → Tauri connect_relay / send_relay_message
                              → relay.rs: connect_relay_internal + pending_acks + parse_ok_payload
  → onConfirmed / UI “Delivery could not be confirmed”
```

## Failure modes (ordered)

1. **Reconnect storm (primary residual):** Warm + mesh `forceReconnectAll` repeatedly dials NativeRelay (`connect_relay` spam in desktop log). Rust `disconnect`/`recycle` calls `fail_pending_acks_for_scope_relay` → OK waiters fail → red toast even when RTT cards look healthy.
2. **Dual readiness lie:** Mesh “publish-ready” / probe ≠ open WS; earlier patches over-corrected then thrashed.
3. **Phase-1 / Phase-2 race:** Skipping `sendToOpen` when `onConfirmed` is set is correct intent, but stacking warm+force on the same path makes confirmation brittle.
4. **Localhost :7000:** Docker relay failed in stack log → `websocket_error` on disabled localhost card — **noise**, not the Nostr path.
5. **Ghost call:** Separate sqlite/`ended` honesty — out of Phase-1 DM restore scope unless it blocks send.

## Keep / freeze / rewrite-scope (subtractive)

| Path | Action |
|------|--------|
| `apps/desktop/src-tauri/src/relay.rs` (OK + connect) | **KEEP** — Rust remains ACK authority |
| `NativeRelay` TS bridge | **KEEP** — thin adapter only |
| Unrelated UI (notifications, voice card chrome, etc.) | **KEEP** — do not restore wholesale |
| `relay-network-warmup` + force dial on every send | **SUBTRACT** (Phase 1) |
| Dual Phase-1/Phase-2 when `onConfirmed` | **KEEP single EVENT+OK** (already intended) |
| `groups/**` publish writers | **FREEZE** (PAUSED) |
| `@obscur/conduit-mesh` package | **FREEZE** package churn; call through existing pool hook |

## Mental simulation

Sender taps Send while Relays show QUIET + APP RTT → warm force-reconnect closes open sockets → Rust fails pending ACKs → publish times out → toast “Delivery could not be confirmed” → message stuck pending. Receiver never sees EVENT. Neighbor modules (identity, persistence UI) must not regress.

## Proof layers (named before mutate)

- **L1:** `pnpm -C apps/pwa exec vitest run` dm-send-pipeline · dm-relay-transport · (warmup deleted or no-op) · nostr-ws-client  
- **L2:** `cargo check -p obscur_desktop_lib` (relay.rs untouched preferred)  
- **L3:** Desktop parity — A→B text DM confirms; Relays open sockets stable (no dial storm); no false delivery toast  
- **L4:** Out of scope this charter
