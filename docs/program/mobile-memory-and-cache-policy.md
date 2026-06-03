# Mobile memory and progressive cache policy (N-series extension)

**Status:** Structural policy — implementation incremental  
**Related:** [navigation-performance-contract.md](./navigation-performance-contract.md) · [obscur-shell-perf-baseline-s0.md](./obscur-shell-perf-baseline-s0.md)

---

## Goal

Keep Obscur viable on **~4GB mobile** devices without unbounded IndexedDB / chat-state growth or eager route parse on every surface.

---

## Owner map (single path per concern)

| Concern | Owner | Must not duplicate in |
|---------|--------|------------------------|
| Compact layout tier | `use-mobile-compact-layout.ts`, `use-secondary-page-layout-tier.ts` | Ad-hoc `md:` breakpoints on each page |
| Route chunk strategy | `create-sidebar-route-page.tsx` + `resolveRouteNavigationWarmupMode()` | Per-page `dynamic()` without sidebar registration |
| Settings tab parse | `settings-tab-panel-loader.tsx` + lazy provider | Sync import of `settings-tab-panel-model-provider` |
| Local media / vault index | `local-media-store.ts` | Parallel caches in components |
| Chat-state retention | `dm-conversation-message-retention-dedupe.ts` | Per-hook retention filters |
| Tombstone / delete suppression | `messagingClientOperations` (R1) | Direct tombstone store in UI |

---

## Phased delivery (implementation-first)

| Phase | Intent | Gate |
|-------|--------|------|
| **M1** | Compact mobile shell + contained scroll (P13/P14) | Vitest on layout hooks + page shells |
| **M2** | Navigation N4/N5 on mobile — lazy routes, settings sub-chunks | `release:test-pack` + manual mobile soak (batched) |
| **M3** | Progressive cache tiers — warm display cache, cold full hydrate | Contract test + profile-scoped storage audit |
| **M4** | Self-cleaning retention — vault index + tombstone TTL sweep | Opt-in policy doc + incremental owners |

Manual mobile matrix: [deferred-manual-verification-checklist.md](./deferred-manual-verification-checklist.md) §5.

---

## Forbidden patterns

1. Eager import of all sidebar route clients on mobile shell builds.
2. Unbounded in-memory message arrays without retention pass on compact layout.
3. Second warm-up path that loads full chunks during rapid nav (use coordinator + `shell-only` on desktop only).

---

## Evidence commands

```bash
pnpm -C apps/pwa exec vitest run app/features/runtime/use-mobile-compact-layout.test.ts app/features/runtime/use-secondary-page-layout-tier.test.ts
pnpm perf:shell:s0:prod    # N6 prod navigation baseline (static out/)
pnpm gateway:boundaries:check
```
