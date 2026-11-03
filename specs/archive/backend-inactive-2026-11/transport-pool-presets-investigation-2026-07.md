# Transport pool + presets — investigation (v1.9.14)

**Date:** 2026-07-17  
**Unit:** [v1.9.14-scope.md](../../docs/program/v1.9.14-scope.md) P14-P / P14-S  
**Status:** Investigation complete — design follows

---

## Symptom / goal

Maintainer verified Vault LES (1.9.13). Next unit: **connection pooling reliability** and **user-facing transport presets** so evaluators can pick defaults without Nostr expertise — while **client-side encryption** (E2EE + LES) stays fixed.

---

## Current owners (grep + truth map)

| Layer | Owner | Path |
|-------|--------|------|
| UI pool hook (tri-route) | `useRelayPoolRuntime` | `apps/pwa/app/features/relays/hooks/relay-pool-hook-port.ts` |
| Conduit Mesh pool (default desktop) | `useConduitMeshRelayPool` | `apps/pwa/app/features/relays/hooks/use-conduit-mesh-relay-pool.ts` |
| Mesh runtime | `createConduitMeshRelayPoolRuntime` | `packages/obscur-conduit-mesh/src/conduit-mesh-relay-pool-runtime.ts` |
| URL → conduit descriptors | `resolveRelayPoolConduitDescriptors` | `packages/obscur-conduit-mesh/src/resolve-relay-pool-conduit-descriptors.ts` |
| Legacy pool (opt-out) | `useLegacyEnhancedRelayPool` | `enhanced-relay-pool-legacy.ts` (~1.6k LOC) |
| Transport-kernel pool (env off mesh) | `useTransportKernelRelayPool` | `use-transport-kernel-relay-pool.ts` |
| Mesh hook gate | `shouldUseConduitMeshRelayPoolHook` | `conduit-mesh-pool-hook-port.ts` |
| Relay list persistence | `useRelayList` / settings model | `use-relays-settings-model.ts` |
| Relay URL presets (today) | `RELAY_PRESETS` inline | `settings-tab-panel-shared.tsx` |
| Conduit mesh UI | `ConduitMeshSettingsPanel` | `features/relays/components/conduit-mesh-settings-panel.tsx` |

**Default desktop path:** transport-kernel authority → Conduit Mesh pool hook → mesh relay-pool runtime. Legacy pool only when transport-kernel hook is off.

---

## Parallel paths (subtraction candidates)

| Path | Risk |
|------|------|
| Legacy `enhanced-relay-pool-legacy` still mounted when env disables mesh | Stale health / duplicate reconnect |
| Tri-route instantiates three hooks (legacy + mesh + kernel) with inert URLs | React cost; confusing for agents |
| Presets only in settings shared module | No mesh/local preset story; hard to extend |

**Do not** delete legacy pool in 1.9.14 — subtract only after mesh pool L3 soak on failover.

---

## Gaps vs product bar

| Gap | Severity |
|-----|----------|
| Presets are Nostr public WS only — no **local dev mesh** pack | P1 UX |
| Preset catalog not a named module — settings monolith | Maintainability |
| Pool health UI exists but copy still says "Nostr DM" not "adapters + ciphertext" | Honesty (S3) |
| Failover L3 not automated in gate for 1.9.14 | P2 deferred to soak |

---

## Proof plan (1.9.14)

| Layer | Command / action |
|-------|------------------|
| L1 | `transport-preset-catalog.test.ts` · existing `conduit-mesh-c5` / pool contracts |
| L3 | Apply local dev preset → `ws://localhost:7000` enabled → DM send with relay up |
| L3 | Kill one relay in redundancy preset → publish still succeeds or fails closed honestly |

---

## Recommendation

1. **S1 first:** canonical `transport-preset-catalog` + wire Settings (this slice).  
2. **S3:** encryption honesty copy in Relays panel.  
3. **P2/P3:** mesh pool failover soak + badge alignment (follow-on slice).  
4. **No** community roster or vault changes.
