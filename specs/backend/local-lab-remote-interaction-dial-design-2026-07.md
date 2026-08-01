# Design — Local lab vs remote interaction dial (E2c)

- Date (UTC): 2026-08-01
- Product rule (maintainer): **Local nodes are lab/test only.** True remote interaction requires a **public relay or VPS** in the active dial set.
- Investigation: [relay-public-disconnect-local-false-latency-investigation-2026-07.md](./relay-public-disconnect-local-false-latency-investigation-2026-07.md)
- Parent: [public-nostr-relay-pool-module-design-2026-07.md](./public-nostr-relay-pool-module-design-2026-07.md)

## Session gate

```text
NEXT ATOMIC STEP: Hold — local false-latency probe fix (L1) · public dial still open
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNER: resolveActivePoolRelayUrls
PROOF: L1 relay-primary-selector vitest
OUT OF SCOPE: community un-pause · claiming public Nostr production-ready · AUTH-SESSION
```

## Goal

When the enabled list includes remote URLs (public Nostr / VPS) **and** a local lab relay is open, the active pool must **still dial at least one remote** URL. Local may stay for soak/writable honesty; it must not be the sole dialed member if remotes are enabled.

## Invariants

1. `isLocalDevWorkspaceRelayUrl` marks lab-only (`ws://localhost:7000` family).
2. Wave A: promoting open local when public primary is dead remains valid for **writable** honesty.
3. **Subtraction of starvation:** basic `return [bestOpen]` when `bestOpen` is local and remotes are enabled is forbidden.
4. Redundancy pad already walks ordered URLs; ensure local-high-score cannot fill all slots before remotes when remotes are enabled (reserve ≥1 remote slot when any remote is enabled).

## Slice E2c — `resolveActivePoolRelayUrls`

### Basic mode

When primary is not live and `bestOpen` is local-dev:

- Return `[bestOpen, ...coldRemote…]` capped at `1 + min(2, remoteCount)` (local + up to 2 remotes), preferring list order among non-local, non-circuit-open URLs.
- If primary itself is remote, prefer `[primary, bestOpen, ...]` then trim to cap (primary kept for reconnect attempts).

When primary is live (including live remote): unchanged (`[primary]`).

### Redundancy mode

After building the scored/padded pool (max 3):

- If any enabled URL is remote and the pool is **local-only**, replace or append so at least one remote is present (prefer first remote in `orderedEnabledUrls`).

## Non-goals

- Disabling local bootstrap / changing product boot preset (`local_dev_mesh`)
- Auto-applying Default Stable
- UX copy rewrite beyond optional one-line later

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/relays/services/relay-primary-selector.test.ts` |
| L3 | Optional: Relays with local+public enabled → at least one public card not forever DISCONNECTED solely due to dial starvation |

## Claim language

- After L1: remote dial pad **implemented**.
- Remote interaction **verified** only with desktop evidence of open public/VPS socket while local remains enabled.
