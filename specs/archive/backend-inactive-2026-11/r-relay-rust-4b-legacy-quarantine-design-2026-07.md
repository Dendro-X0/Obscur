# Design — R-RELAY-RUST-4b quarantine `enhanced-relay-pool-legacy`

**Status:** L1 Pass · 2026-07-30  
**Prior:** [RUST-4a](./r-relay-rust-4-ts-failover-subtraction-design-2026-07.md) · [L3-product](../../docs/handoffs/r-relay-rust-l3-product-2026-07-30.md) · [Tauri UI soak](../../docs/handoffs/r-relay-rust-l3-tauri-ui-soak-2026-07-30.md)

---

## Landed

| Piece | Location |
|-------|----------|
| Quarantine banner | `enhanced-relay-pool-legacy.ts` (`RUST-4b QUARANTINE`) |
| Native never selects legacy pool hook | `shouldUseLegacyRelayPoolHook` requires `!hasNativeRuntime()` |
| Contracts | `relay-publish-owner.contract` · pool-hook port tests |

## Proof

| Layer | Result |
|-------|--------|
| L1 vitest pool-hook + publish-owner | **9/9 Pass** |
| Packaged Tauri UI soak (CDP) | **PASS** — configure · snapshot healthy · publish accepted · damus escape rejected |
| File deleted | **No** (4c later) |

## Claim language

| May say | When |
|---------|------|
| RUST-4b quarantine Pass | This file + L1 |
| Packaged UI mesh soak Pass | [tauri UI soak](../../docs/handoffs/r-relay-rust-l3-tauri-ui-soak-2026-07-30.md) |
| Legacy file deleted | RUST-4c only |
| Public Nostr fixed | No |
