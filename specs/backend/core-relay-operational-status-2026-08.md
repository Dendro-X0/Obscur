# Core functions + relay stability — operational status

**Date (UTC):** 2026-08-04 (updated)  
**Goal:** Obscur core messaging operational; relay path stable for **production-like** use (not Docker lab).  
**Parent docs:** [CURRENT.md](../../docs/CURRENT.md) · [self-hosted-relay-vps-operator-notes-2026-08.md](../../docs/program/self-hosted-relay-vps-operator-notes-2026-08.md)

---

## Session header

```text
NEXT ATOMIC STEP:     Maintainer manual core verify · production relay stability (no Docker as product path)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      mesh pool publishToUrls · operator relay (VPS / trusted clearnet)
PROOF BEFORE DONE:    Maintainer: stable publish path on non-lab endpoint + core flows one-by-one
OUT OF SCOPE:         Soft L3 Docker ship claim · public Nostr SLA · Tor C13 · community
```

---

## Maintainer direction (2026-08-04)

- Manual verification of core functions **one by one**.
- First: **long-term relay stability** without relying on local Docker containers.
- Soft L3 / `ws://localhost:7000` remains a **lab fixture only** — parked as ship evidence.

## Docs-aligned posture

| Surface | Role |
|---------|------|
| `ws://localhost:7000` | Lab / Soft L3 only — not multi-user remote |
| Public clearnet (`nos` / `primal` / `damus`) | Best-effort rendezvous — **no SLA** |
| Self-hosted VPS `wss://…` | Preferred for team remote / long soak |

## Screenshot read (Relays settings)

| Observation | Meaning |
|-------------|---------|
| Publish path = **localhost** · `ws://localhost:7000` QUIET + ACTIVE | Client is on lab endpoint (often Soft L3 / dial leftover) |
| `nos.lol` / `primal` / `damus` DISCONNECTED + STANDBY | Not in active pool — Degraded “2 of 4” is expected under this mix |
| Avg RTT ~929ms on localhost QUIET | Quiet ≠ broken socket; latency chip alone is not a failure claim |

For production-like soak: take localhost out of the active mix, point at a **trusted remote you operate** (VPS) or accept as rendezvous, then prove DM publish/receive on that path.

W66/W67 standalone legacy subtraction remains **closed**. Product publish owner = mesh `pool.publishToUrls`.
