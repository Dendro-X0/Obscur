# Design — Relays UI honesty U4–U5 (offline primary + last Connect)

- Date (UTC): 2026-08-01
- Trigger: Maintainer continue + desktop Relays screenshot after U1–U3
- Evidence: nos.lol **DISCONNECTED** + **PRIMARY** + **Connect 1371ms** (red history); primal/localhost **QUIET** open pool

## Session gate

```text
NEXT ATOMIC STEP: Hold — Relays UI honesty U1–U3 (L1 Pass); continue → U4–U5
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: format-relay-latency-label · deriveRelayNodeStatus · RelayMetricCard
PROOF: L1 format-relay-latency-label + relay-runtime-status + relay-dashboard
OUT OF SCOPE: COM-RUN · AUTH-SESSION · Mbps · public SLA · mesh failover ownership rewrite
```

## Screenshot inventory

| Signal | Verdict |
|--------|---------|
| U1 PRIMARY (not Active transport) on offline nos | **Pass** |
| U2 localhost alias card | **Pass** (single localhost card) |
| Quiet on open idle sockets | **Pass** |
| Offline primary + open pool members | Expected under current failover gate (`writable > 0` → no primary failover) |
| Connect 1371ms on DISCONNECTED | Misleading — reads as live latency |

## Root cause (selection)

`shouldAttemptPrimaryFailover` only runs when `writableRelayCount === 0`. With primal/localhost open, supervisor will not promote primary away from nos.lol. Mesh may also own failover (`meshSchedulerOwnsFailover`). Changing that is a transport-ownership slice — **out of this UI honesty band**.

## Contracts

### U4 — Last Connect / Last RTT when socket not open

`formatRelayLatencyLabel(metrics, { socketOpen?: boolean })`:

| Socket | Source | Label |
|--------|--------|-------|
| open / unknown | app | `RTT Nms` |
| open / unknown | connect | `Connect Nms` |
| not open | app | `Last RTT Nms` |
| not open | connect | `Last Connect Nms` |
| no samples | — | `n/a` |

History caption when not open: `Last Connect` / `Last App RTT` (vs live Connect / App RTT).

Zap color for disconnected cards: treat as non-live (amber/neutral), not “current RTT quality”.

### U5 — Primary offline role copy

When `role === "primary"` and socket not open:

- `roleLabel`: `Primary (offline)` (was `Primary`)
- detail: keep existing primary-disconnected sentence

i18n defaults on settings list translator for the new role string.

## Slice

1. Extend format helpers + L1 tests.
2. `deriveRelayNodeStatus` roleLabel Primary (offline).
3. Wire `socketOpen` into RelayMetricCard format calls.
4. Settings `translateRelayNodeRole` case.

## Claim

- After L1: U4–U5 **implemented**.
- Primary auto-promote while writable>0 remains **out of scope** (supervisor/mesh ownership).
