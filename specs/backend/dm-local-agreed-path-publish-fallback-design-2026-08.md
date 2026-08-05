# Design — Local agreed-path publish fallback (Soft L3 D1)

**Investigation:** [dm-local-agreed-path-publish-fallback-investigation-2026-08.md](./dm-local-agreed-path-publish-fallback-investigation-2026-08.md)

## Contract (`publishToRelays`)

1. Attempt `publishToUrls(targetRelayUrls)` (S1-scoped; remotes preferred).
2. On failure: if pool has **open** local workspace relay(s) (`isLocalDevWorkspaceRelayUrl`), `publishToUrls(openLocal)` and return on quorum.
3. Else existing `publishToAll` → last-resort no-ACK failure (D2).

## Invariants

- D2 P-evidence unchanged (OK required).
- S1 production preference unchanged (remotes first).
- Local retry is assist when remotes fail ACK — Soft L3 / lab agreed path.

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/messaging/controllers/v2/dm-relay-transport.test.ts` |
| L3 | `pnpm verify:s-pool-delivery-l3` |
