# Investigation — Mobile tab navigation looks dead (2026-10)

## Symptom

Phone preview / mobile shell: tap Network / Vault / Settings. Focus ring may appear on the tab, but the active (purple) tab stays on Chats and the page body does not change for a long time — feels like “no navigation.”

Screenshot evidence: Vault has OS focus outline; Chats remains the active product tab; empty chats surface still shown. Build stamp `SHELL-2026-10-23…` may be a stale preview session.

## Evidence (code)

1. `MobileTabBar` `onClick` **preventDefault**s and soft-pushes via `scheduleSidebarNavigation(..., { immediate: true })` → `startTransition(router.push)`. Pathname (and active styling) only update after the App Router commits.
2. There is **no optimistic pending tab** and **no call** to `beginNavigation` on tab click (desktop sidebar Link also skips it).
3. Global nav progress UX is **intentionally off**:
   - `GlobalNavigationLoadingBar` uses `sr-only`
   - `syncGlobalNavLoadingPaint` always clears attrs (“progress UX is off”)
4. Dev / desktop-shell stall hard-fallback is **15s** (`ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS`). Soft recover only then.
5. First visit to a lazy sidebar route pays Next/webpack compile on the click path (documented in stall-recovery comments). High relay invoke pressure in the running preview worsens main-thread contention.

## Hypotheses (ranked)

| # | Hypothesis | Likelihood |
|---|------------|------------|
| H1 | Soft push is in flight but cold route compile + no pending UI → user perceives dead nav | High |
| H2 | Soft push dropped / starved under `startTransition` + main-thread load until 15s fallback | Medium |
| H3 | Overlay / pointer layer blocks clicks (focus-only) | Low — focus + preventDefault path runs |
| H4 | Stale preview build without recent nav guards | Contributing — hard-reload still required |

## Non-goals

- Re-enable full page-transition overlays / mount-probe fan-out (perf contract)
- Chunk `import()` on the click path (forbidden by navigation-performance-contract)
- B2 release smoke (separate handoff step)

## Fix slice (smallest)

1. Optimistic `pendingHref` on `MobileTabBar` (active styling + `aria-busy`) until pathname matches or pending clears.
2. Call `beginNavigation(href)` on tab click; restore a **visible** top progress bar (remove `sr-only`; keep paint sync no-op / off).
3. Shorter stall hard-fallback when `isMobileShellProduct()` (e.g. 6s) so soft recover fires sooner in preview.
4. L1: extend `mobile-tab-bar.test.tsx` for pending + beginNavigation. L2: hard-reload preview, Chats → Vault.

## Proof

- L1: `pnpm --filter pwa exec vitest run app/components/mobile-tab-bar.test.tsx`
- L2: `dev:mobile-preview` — tap Vault; pending purple + progress within 1 frame; route settles or soft-recovers &lt; ~6s

## Implemented (2026-10-24)

- Optimistic `pendingHref` + `beginNavigation` on `MobileTabBar`; visible top progress bar
- Immediate `router.push` (no `startTransition`) for tab soft-nav
- Mobile shell stall hard-fallback **6s**; desktop/dev remains 15s
- L1: mobile-tab-bar + schedule-sidebar-navigation + app-shell tests green
