# Soft L3 lab relay without Docker (2026-08-02)

## Problem

Soft L3 agreed path is `ws://localhost:7000` (Docker `nostr-rs-relay`). On this host Docker Desktop is **not installed/running**, so `pnpm dev:relay:docker` cannot start.

## Decision

Add `scripts/soft-l3-lab-relay.mjs` — minimal NIP-01 WebSocket relay (EVENT → OK, REQ → match + EOSE) on `:7000` using the repo `ws` dependency. Lab-only Soft L3 assist; **not** a production relay claim.

## Proof

| Layer | Command |
|-------|---------|
| L3 preflight | TCP/`ws` connect to `ws://localhost:7000` |
| Soft L3 | `pnpm verify:s-pool-delivery-l3` with dual CDP when available |

## Forbidden

Do not claim public Nostr SLA from this relay.
