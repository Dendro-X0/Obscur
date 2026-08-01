# Design — Standby latency probe open-handshake fallback

- Date (UTC): 2026-08-01
- Investigation: [relay-public-disconnect-local-false-latency-investigation-2026-07.md](./relay-public-disconnect-local-false-latency-investigation-2026-07.md)

## Goal

When a relay WebSocket **opens** but sends **no** frame before the frame deadline, recorded latency must be **time-to-open**, not time-to-frame-timeout (~6000ms). Aligns with existing file comment.

## Contract

| Event | Result |
|-------|--------|
| Message before deadline | `ok: true`, `latencyMs = now - start` |
| Open, then frame deadline | `ok: true`, `latencyMs = openedAt - start` (≥1) |
| Never opens (open timeout) | `ok: false`, `latencyMs: 0` |
| Error / early close | `ok: false`, `latencyMs: 0` |

## Slice

- Edit `standby-latency-prober.ts` only (+ unit test expectations).
- No Relays UI / dial / NativeRelay changes in this slice.
- Public disconnect remains **investigation-open** until runtime evidence.

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/relays/services/standby-latency-prober.test.ts` |
| L3 | Optional: Relays card for localhost should not show ~6000ms solely from quiet open |

## Claim language

- After L1: false high-latency sample path **implemented**.
- Local HIGH LATENCY **fixed** only with UI evidence after reload.
- Public connect **not** claimed by this slice.
