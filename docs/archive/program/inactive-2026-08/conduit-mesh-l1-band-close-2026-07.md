# Conduit Mesh — L1 code band close (C0–C14)

**Status:** **Closed for L1 code slices** · 2026-07-15  
**Verify tip:** `pnpm verify:conduit-mesh-c14`  
**Handoff:** [current-session.md](../handoffs/current-session.md)

---

## What landed (L1)

| Slice | Title | Gate |
|-------|-------|------|
| C1–C5 | Contracts → pool retirement | prior |
| C6–C7c | Nostr WS + client integration | prior |
| C8 | Reference HTTP gateway | `verify:conduit-mesh-c8` |
| C9 | Tor host policy port | `verify:conduit-mesh-c9` |
| C10 | HTTP pull/subscribe | `verify:conduit-mesh-c10` + **L3 PASS** |
| C11 | Mesh-native DM wire codec | `verify:conduit-mesh-c11` |
| C12 | Long-poll stream | `verify:conduit-mesh-c12` |
| C13 | Tor SOCKS HTTP fetch | `verify:conduit-mesh-c13` |
| C14 | SSE stream | `verify:conduit-mesh-c14` |

---

## Explicitly not claimed (L3+)

| Runbook | Goal |
|---------|------|
| [conduit-mesh-c14-l3-sse-soak-runbook.md](./conduit-mesh-c14-l3-sse-soak-runbook.md) | HTTP DM receive p95 &lt; 5s with SSE |
| [conduit-mesh-c13-l3-tor-socks-soak-runbook.md](./conduit-mesh-c13-l3-tor-socks-soak-runbook.md) | `tor_required` / onion HTTP via SOCKS |
| [conduit-mesh-c7-l3-soak-runbook.md](./conduit-mesh-c7-l3-soak-runbook.md) | Default WS mesh dual-window (still open) |

---

## Non-goals after this close

- Inventing C15+ without a new maintainer charter
- Patching PAUSED vault / community bands under mesh work
- Claiming L3 from L1 alone

---

## Resume rule

New Conduit Mesh code requires a **new charter** in `docs/program/` + handoff atomic step. Maintainer may pick any open L3 runbook as the next session without a new L1 slice.
