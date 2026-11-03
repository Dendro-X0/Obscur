# Design + frontend — Compact offline Relays metric cards (U6)

- Date (UTC): 2026-08-01
- Trigger: Maintainer — offline Relays cards look cluttered
- Evidence: screenshot — DISCONNECTED cards still show Latency History, Success n/a, Stability duplicate, long detail boxes

## Session gate

```text
NEXT ATOMIC STEP: Hold — Relays UI honesty U4–U5; continue → U6 compact offline
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: RelayMetricCard · deriveRelayNodeStatus (short offline detail)
PROOF: L1 relay-dashboard (+ runtime-status if detail strings change)
OUT OF SCOPE: Quiet/open card redesign · primary failover · COM-RUN · AUTH-SESSION
```

## Problem

Offline cards mirror the full live layout: sparkline (or empty dashed box), Success/Stability n/a, and a multi-line detail panel — high noise for “not connected.”

## Compact contract

Compact when `derivedStatus.status === "unavailable"` (Disabled / Error / Disconnected — not Connecting/Quiet/Healthy).

| Keep | Hide |
|------|------|
| Hostname | Latency History sparkline / empty dashed area |
| Badge + role | Success Rate + Stability grid (badge already says state) |
| Latency chip (Last Connect / n/a) | Boxed detail panel |
| One-line detail under header | — |
| lastError if present | — |

Visual: slightly quieter card (`border-dashed` or reduced opacity) so open Quiet/Healthy cards stay the focus.

## Short offline detail (same owner)

| Role | Compact detail |
|------|----------------|
| Primary offline | `Selected primary — no open socket yet.` |
| Standby offline | `Not in the active transport pool.` |
| Other offline | `No active socket.` |

Settings list translator: add exact-match cases (defaultValue English).

## Quiet / open cards

Unchanged (full sparkline + stats + Quiet explanation).

## Proof

- L1: disconnected primary render → has Last Connect + Primary (offline); **no** “Success Rate”, **no** “Latency History”, **no** “No latency samples yet”
- Open Quiet card still shows Latency History / App RTT
