# D3 — Multi-node soak on default public pool

**Date (UTC):** 2026-08-04  
**Parent:** [relay-pool-auto-correction-modes-design-2026-08.md](./relay-pool-auto-correction-modes-design-2026-08.md)  
**Related:** [transport-pool-health-design-2026-07.md](./transport-pool-health-design-2026-07.md) · P14-P

---

```text
NEXT ATOMIC STEP:     D3 Multi-node on Default Stable public pool
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      mesh publishToUrls · resolveActivePoolRelayUrls(redundancy) · P14 badge
PROOF BEFORE DONE:    L1 multi-node contracts · L2 clearnet NIP probe · L3 dual-DM deferred if Soft L3 blocked
OUT OF SCOPE:         Soft L3 Docker ship · public Nostr SLA · dual failover
```

---

## Acceptance

1. Boot / Default Stable is **Multi-node** (`redundancy`) with ≥3 public WSS URLs.  
2. Active pool in redundancy dials **multiple** enabled remotes (not single-primary only).  
3. Partial publish-ready (1 of N Default Stable) → Settings badge **degraded** (P14).  
4. Clearnet probe: ≥1 Default Stable relay reachable (NIP probe) — availability evidence, **not** SLA.  
5. Dual-window DM on ≥2 remotes = full L3 — only when desktop Soft L3 harness is healthy (not claimed via Docker lab).

---

## Layers

| Layer | Deliverable |
|-------|-------------|
| L1 | `relay-pool-modes-d3-multi-node.contract.test.ts` |
| L2 | `pnpm probe:relay-nip` against Default Stable URLs |
| L3 | `verify:e2-public-only-l3` and/or Soft L3 Row B — **attempt if CDP up; else deferred** |

---

## Proof (2026-08-04)

| Layer | Result |
|-------|--------|
| L1 `relay-pool-modes-d3-multi-node.contract.test.ts` + P14 contract | **Pass** (4) |
| L2 `pnpm probe:relay-nip` Default Stable | **Blocked** this host — all `relay_socket` / `nip11_fetch` **timeout** (nos / primal / damus) · not an SLA claim either way |
| L3 dual-DM / `verify:e2-public-only-l3` | **Deferred** — Soft L3 CDP parked · no healthy desktop harness this step |

**D3 slice claim:** L1 multi-node honesty on Default Stable **Pass**. Full soak remains maintainer/runtime when clearnet + desktop are reachable.
