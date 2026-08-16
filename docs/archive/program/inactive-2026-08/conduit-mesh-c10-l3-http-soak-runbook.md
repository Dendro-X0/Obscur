# Conduit Mesh C10 — L3 HTTP-only DM soak runbook

**Status:** **Active** — manual evidence band (maintainer)  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c10-http-pull-subscribe-charter.md](./conduit-mesh-c10-http-pull-subscribe-charter.md)

**Interim soak (2026-07-15):** Row A **PASS**. Row B **PASS** on marker `C10-L3-soak-20260715I` after blockers (9)–(11) (HTTP-only targets · pull audience filter · inbound re-arm). Gateway `recipientPublicKeyHex` filter returns the DM; Tester2 decrypt delivers within 45s. Reply marker `…I-reply` checked in handoff.

---

## Goal

Prove end-to-end **DM receive over HTTP gateway only** — no `wss://` relay in the enabled pool. Validates C10 pull loop + Nostr wire bridge under real desktop runtime.

**Not claimed** until maintainer posts sign-off row.

---

## Preconditions

| Check | Command / action |
|-------|------------------|
| L1 green | `pnpm verify:conduit-mesh-c10` |
| Mesh gateway running | `MESH_HTTP_PORT=8788 pnpm -C apps/relay-gateway dev` (or operator gateway) |
| Desktop strict kernels | Do **not** set `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1` |
| Mesh default | Do **not** set `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=0` |
| Pool URLs | **HTTP only** — e.g. `http://127.0.0.1:8788` in Settings → Relays (remove all `wss://`) |

Boot:

```bash
# Terminal A — mesh HTTP gateway (keep running between sessions)
MESH_HTTP_PORT=8788 pnpm -C apps/relay-gateway dev

# Terminal B — desktop (freshness guard runs on predev)
pnpm dev:desktop -- --online --skip-build   # after a successful rebuild
# pnpm dev:desktop -- --online --rebuild    # when packages/app or @obscur/* changed
```

Avoid `dev:desktop:no-coord` unless Docker relay is up — it stalls on relay wait. Mesh-only C10 soak needs gateway + desktop only.

---

## Row A — Settings / Conduits honesty

| Step | Action | Pass criterion |
|------|--------|----------------|
| A1 | Settings → Relays | **Conduit transport** panel visible |
| A2 | Enabled URL | Single `http://127.0.0.1:8788` (or team gateway) with **Team relay** dialect badge |
| A3 | No WS relays | No `wss://` URLs enabled |
| A4 | Tor badges | If Tor enabled: badges reflect C9 snapshot; HTTP SOCKS path is C13 ([L3 runbook](./conduit-mesh-c13-l3-tor-socks-soak-runbook.md)) |

---

## Row B — Dual-window DM (HTTP-only pool)

Two desktop windows (Profile A / Profile B), **same HTTP gateway URL** in both pools.

| Step | Action | Pass criterion |
|------|--------|----------------|
| B1 | A sends DM text to B | Message appears in B thread within **45s** (pull interval default 3s + decrypt) |
| B2 | B replies | Message appears in A thread within **45s** |
| B3 | Inspect gateway | `GET /mesh/v1/envelopes` returns published items (curl or relay-gateway logs) |
| B4 | Cold focus B window | No duplicate replay storm in console |

Evidence: screenshot or CodaCtrl chain id; note HTTP gateway URL and pull latency observed.

---

## Row C — Publish path sanity

| Step | Action | Pass criterion |
|------|--------|----------------|
| C1 | A sends while B offline | Gateway stores envelope (gateway `size` or pull returns item) |
| C2 | B opens thread | Offline message delivered on next pull cycle |

---

## Failure triage

| Symptom | Likely owner | First check |
|---------|--------------|-------------|
| Send OK / no receive | C10 pull + `registerInboundInterests` | DM subscribe active? `#p` filter matches recipient pubkey? |
| No pull traffic | `custom-http-conduit-driver` | Network tab: periodic `GET /mesh/v1/envelopes` |
| Receive but no decrypt | DM pipeline (not C10) | Ciphertext is Nostr `EVENT` wire inside mesh envelope |
| HTTP publish fails | C8 gateway / Tor policy | `tor_required` conduit with Tor down → fail-closed (expected) |
| WS still in path | Pool config | Remove all `wss://` from enabled relays |
| HTTP enabled but DM pool empty | `resolveDmTransportRelayUrls` | Loopback `http(s)://` must promote into DM pool ([investigation](../../specs/backend/conduit-mesh-c10-l3-dm-scope-cors-investigation.md)) |
| Send OK / gateway empty | `conduit-mesh-relay-pool-runtime` publish path | Nostr EVENT must use mesh envelope for HTTP dialects (not `nostrWire` WS) |
| CORS on `/mesh/v1/*` | `mesh-http-server` | Restart gateway after CORS land; Origin `http://127.0.0.1:1430` must not fail fetch |
| Stale shell after package edit | `static-shell-stale.mjs` | Rebuild or refuse `--skip-build`; dev stamp banner if DOM ≠ manifest |
| Hybrid targets escape HTTP-only pool | `resolveTargetRelayUrls` | When configured pool is loopback mesh HTTP only, publish targets = pool only |
| Presence flood starves pull | `mesh-http-gateway-handler` + pull | Pull with `recipientPublicKeyHex`; restart gateway between soaks if store is huge |
| No GET pulls after reload | `create-conduit-mesh.configureConduits` | Must re-arm `registerInboundInterests` after remount |

---

## Known gaps (honest scope)

| Gap | Slice |
|-----|-------|
| 3s poll latency | C12 long-poll / SSE |
| `tor_required` HTTP over Tor | C13 SOCKS on drivers |
| Mesh-native ciphertext (non-Nostr) | C11 codec |

---

## Sign-off

```text
C10 L3 HTTP-only — PASS — 2026-07-15 — http://127.0.0.1:8788 — ≤10s recv — markers C10-L3-soak-20260715I / …I-reply; shell-2026-07-15T10:36:16Z; blockers 9–11
```
