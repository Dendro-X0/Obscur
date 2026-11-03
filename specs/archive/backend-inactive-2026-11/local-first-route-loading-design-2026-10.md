# Design — Local-first tab route loading (2026-10)

## Goal

Tab switches feel **native / on-device**: chrome and skeleton paint on the click frame from local assets. Relay / network work must not gate the first paint of a secondary route shell.

## Constraints

- Honor `navigation-performance-contract.md`: no route-client `import()` on the click path; no second warm-up owner.
- Do not re-enable Lane X / `shouldEnableNavigationProgressUx` globally (still `false` — freeze risk).
- Handoff PAUSED bands untouched.

## Contract

| Moment | Behavior |
|--------|----------|
| Tab click | `beginNavigation(href)` + optimistic tab; **instant local shell** covers route body (skeleton for target surface) |
| Route commit | Same skeleton may remain as `dynamic()` `loading` until page client mounts |
| Page client mounted | Shell dismisses when nav loading settles (`pathname` matches target); page may still show **local** empty/loading for LES/SQLite — never “waiting on network” copy for shell |
| Production mobile/desktop static | Sidebar route clients **eager** from disk (no chunk wait after install) |
| Dev webpack preview | Lazy chunks OK; instant shell hides compile wait |

## Owners

| Concern | Owner |
|---------|--------|
| Instant shell visibility | `LocalRouteTransitionShell` ← `useGlobalNavigationLoadingState` |
| Mount point | `AppShell` content column (above `{children}`) |
| Skeleton visuals / copy | `RouteWarmupSkeleton` + page `createSidebarRoutePage` loading strings |
| Eager vs lazy | `create-sidebar-route-page.tsx` (`shouldUseEagerShellSidebarRoute`) |

## Non-goals

- Prefetching relay contact graphs into Network before paint
- Claiming LES vault media is fully offline-synced
- Re-enabling full page-transition overlays / mount-probe fan-out

## Proof

- L1: unit tests for shell visibility rule + eager mobile production factory
- L2: mobile-preview — tap Vault; skeleton on same frame; no “network” loading copy

## Implemented (2026-10-24)

- `LocalRouteTransitionShell` in AppShell content column (instant on-device skeleton)
- Production mobile + desktop shells: eager sidebar route clients
- Loading copy → “Opening from this device…” / local vault/settings/search
- L1: local-route-transition-shell + create-sidebar-route-page + app-shell + mobile-tab-bar green
