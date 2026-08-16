# Conduit Mesh C14 — L3 SSE receive soak runbook

**Status:** **PASS** — 2026-07-15 dual-window CDP soak  
**Last updated:** 2026-07-15  
**Parent:** [conduit-mesh-c14-sse-stream-charter.md](./conduit-mesh-c14-sse-stream-charter.md)  
**Baseline:** [conduit-mesh-c10-l3-http-soak-runbook.md](./conduit-mesh-c10-l3-http-soak-runbook.md) (Row B already PASS on long-poll/pull)

---

## Goal

Prove HTTP-only DM receive uses **SSE** (`Accept: text/event-stream`) and lands faster than the C10 3s timer path — **p95 receive &lt; 5s** from send click to B thread decrypt.

---

## Preconditions

| Check | Action |
|-------|--------|
| L1 | `pnpm verify:conduit-mesh-c14` |
| Gateway | `MESH_HTTP_PORT=8788 pnpm -C apps/relay-gateway dev` (SSE-capable; rebuild after C14) |
| Desktop | Rebuild shell after C14 (`pnpm dev:desktop -- --online --rebuild`) |
| Pool | **HTTP only** `http://127.0.0.1:8788` on both profiles |
| Health | `GET /mesh/v1/health` → `capabilities` includes `sse` |

---

## Row S — SSE negotiation

| Step | Action | Pass |
|------|--------|------|
| S1 | Curl health | `capabilities` contains `"sse"` and `"long_poll"` |
| S2 | Desktop DevTools / CDP network | After DM subscribe, Tester2 shows lasting `GET …/mesh/v1/stream` with `Accept: text/event-stream` (not repeating 3s pull only) |
| S3 | Optional | Gateway log or proxy shows `Content-Type: text/event-stream` |

---

## Row B′ — Dual-window latency (reuse C10 markers)

| Step | Action | Pass |
|------|--------|------|
| B1 | A → B marker `C14-L3-sse-YYYYMMDDX` | Delivered on B within **5s** (note wall clock) |
| B2 | B → A reply marker | Delivered on A within **5s** |
| B3 | Compare | Observed latency clearly below prior ~3s poll floor (often &lt;1–2s) |

Evidence: timestamps (console `[dm-send]` / delivered) or stopwatch + screenshot.

---

## Row F — Fallback honesty

| Step | Action | Pass |
|------|--------|------|
| F1 | Temporarily break SSE (e.g. gateway without SSE Accept path) | Driver falls back to long-poll or pull; DM still arrives within 45s |
| F2 | Restore SSE | Next session prefers SSE again |

---

## Sign-off

| Field | Value |
|-------|--------|
| Date | 2026-07-15 |
| Shell stamp | `shell-2026-07-15T13:55:42Z` |
| Markers | `C14-L3-sse-20260715A` / `…A-reply` |
| p95 observed | B1 **1876ms** · B2 **2470ms** (both &lt; 5s; below ~3s poll floor) |
| Result | **PASS** (S1+S2+B1+B2) |

```text
C14 L3 SSE — PASS — 2026-07-15 — http://127.0.0.1:8788 — B1 1876ms / B2 2470ms — markers C14-L3-sse-20260715A / …A-reply; shell-2026-07-15T13:55:42Z; CDP Network Accept: text/event-stream on Tester2
```

Row F (SSE break fallback) not exercised this soak.

---

## Out of scope

- Tor SOCKS (C13 runbook)
- WS default pool (C7 L3)
