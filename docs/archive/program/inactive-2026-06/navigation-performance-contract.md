# Navigation Performance Contract

**Status:** Active (v1.9.0 performance gate)  
**Supersedes:** ad-hoc perf fixes in chat/handoff only — this file is the durable source of truth.  
**Related investigation:** [`obscur-startup-navigation-investigation-2026-05.md`](./obscur-startup-navigation-investigation-2026-05.md)

---

## Why tests are not enough

| What CI tests can do | What they cannot do |
|----------------------|---------------------|
| Assert a function was called / skipped under mocked timers | Prove the UI stays interactive under real webpack, SQLite, relay, and multi-window load |
| Guard known regressions at a point in time | Prevent a future agent from adding a second warm-up path without reading architecture |
| Run in jsdom with stubs | Reproduce main-thread long tasks from 4000+ LOC route clients |

**Release evidence for navigation performance is manual + structural**, not “vitest green.” Tests in this area are **checkpoints** — they catch accidental API misuse, not product feel.

---

## Symptom class

**User-visible:** UI stops responding during rapid sidebar / tab switches; CPU and disk may stay low (main-thread queue saturation, not hardware limits).

**Root pattern:** Multiple **parallel owners** schedule heavy work on `pathname` change or nav intent:

- dynamic `import()` of route clients
- intelligent warm-up (critical phase used to run immediately)
- transition overlay + mount probes + stall watchdogs
- provider tree re-render while global hooks stay mounted

---

## Owner map (single path per concern)

| Concern | Owner | Must not duplicate in |
|---------|--------|------------------------|
| When background warm-up may run | `apps/pwa/app/components/navigation-performance-coordinator.ts` | `app-shell.tsx` timers, route pages, providers |
| Full route client chunk load | `apps/pwa/app/components/intelligent-navigation-warmup-runner.ts` via `navigation-chunk-load-authority.ts` | Hover handlers, `useEffect([pathname])`, providers |
| Shell-only prefetch on intent | `prefetchRouteShell()` in `route-navigation-warmup.ts` | `warmRouteNavigationTargets(..., "full")` |
| App chrome layout | `persistent-app-chrome.tsx` + `app-chrome-registry.tsx` | `PageShell` must not wrap `AppShell` |
| Route page entry | `create-sidebar-route-page.tsx` + `sidebar-routes.ts` | Ad-hoc `dynamic()` in each `page.tsx` |
| Nav instrumentation (overlay, probes) | `shouldRunNavigationInstrumentation()` in `experiment-shell-policy.ts` | Unconditional pathname effects |
| Secondary-window startup stagger | `relay-transport-bootstrap-policy.ts`, `secondary-profile-window-reload-scheduler.ts` | Per-window duplicate relay/warmup |
| Global dialog UI | `lazy-global-dialog-manager.tsx` | Unconditional `GlobalDialogManager` mount |
| Network / invites request transport | `use-network-request-transport.ts` → runtime transport owner | `useEnhancedDmController` on network, profile, or invites surfaces |

---

## Forbidden patterns (will cause freeze recurrence)

1. **`import()` route client on hover, focus, or pathname** — use `prefetchRouteShell` only.
2. **Parallel warm-up systems** — no second prefetch planner; extend `intelligent-navigation-warmup-policy.ts` if needed.
3. **Critical-phase eager chunk load** — all targets sequential + idle; never `Promise.all` on multiple route chunks during nav.
4. **Remounting `AppShell` per route** — use `useRegisterAppChrome` overrides only.
5. **Mount probes / transition overlay on experiment desktop** without explicit contract amendment.
6. **Re-enabling full warm-up + full instrumentation + full relay bootstrap** in the same release “to test.”
7. **Second `useEnhancedDmController` on network/invites/profile routes** — use `useNetworkRequestTransport()`.

---

## Allowed sequences

### User click (fast path)

```
click → recordNavigationIntent → router.push → route body mounts
       → NO chunk import
       → NO warm-up until quiescence
```

### After quiescence (2s idle, not rapid mode)

```
coordinator quiesced → app-shell schedules warm-up
  → runWithNavigationChunkLoadAuthority
  → sequential idle chunk load (one href at a time)
```

### Hover / focus (intent only)

```
prefetchRouteShell(router, href)   // Next route shell only
```

---

## Manual rapid-nav gate (milestone evidence — not per-slice blocker)

Run **once per navigation perf milestone** (or before a user-visible tag), not after every N-lane or settings split. Batched with [deferred-manual-verification-checklist.md](./deferred-manual-verification-checklist.md) per [v1.8.x-batch-implementation-lane.md](./v1.8.x-batch-implementation-lane.md) § Maintainer delivery order.

**Procedure:**

Run on **desktop experiment online** (`pnpm dev:desktop:online`) or packaged shell.

1. Unlock one profile; wait for shell ready.
2. Rapidly switch **10 times** across: Chats → Network → Vault → Search → Settings (as fast as clicks register).
3. **Pass:** Sidebar remains clickable; no multi-second dead UI; no runaway fan/spinning cursor.
4. Pause 3s on Settings; **Pass:** page usable without second freeze wave.
5. Optional: repeat with **Profile 2** in a second window (multi-window gate).

Record date + build label in handoff or PR test plan. Automated tests do **not** replace this gate.

---

## Architecture backlog (N-series)

Structural lanes from investigation — execute when patch loops return:

| Lane | Intent | Status (2026-06) |
|------|--------|------------------|
| **N1** | Persistent chrome layout (single `AppShell`, outlet for bodies) | **Partial** — `PersistentAppChrome` landed; verify no regressions |
| **N2** | Thin route pages (content only, no duplicate shell) | **Partial** — `PageShell` registers chrome only |
| **N3** | Lazy global dialogs / single DM transport on network routes | **Partial** — `LazyGlobalDialogManager` + `useNetworkRequestTransport` (no duplicate controllers) |
| **N4** | Desktop eager sidebar bundle via `sidebar-routes.ts` | **Done** — `createSidebarRoutePage` eager on desktop; warm-up uses `shell-only` via `resolveRouteNavigationWarmupMode()` |
| **N5** | Split settings into tab sub-chunks | **Done** — per-tab model hooks + dynamic providers in `settings-tab-panel-models/` |
| **N6** | Prod-shell perf baseline (`out/` not webpack dev) | **Done (2026-06-03)** — `docs/assets/perf/s0-prod.json` cold-start baseline; nav matrix needs unlocked session |

**Broader mobile / cache:** [mobile-memory-and-cache-policy.md](./mobile-memory-and-cache-policy.md) (M1–M4 phases).

When stalls return after coordinator work, **pick the next N lane** — do not add a fourth warm-up deferral.

---

## Agent / maintainer checklist (navigation PR)

- [ ] Read this contract + `rules/13-navigation-performance.md`
- [ ] No new `import()` on pathname or pointer intent
- [ ] No new pathname `useEffect` that loads data for unrelated routes
- [ ] Owner map updated if new path added
- [ ] Manual rapid-nav gate run (or explicitly deferred with reason in PR)

---

## Diagnostics

| Signal | Meaning |
|--------|---------|
| `[Obscur navigation] Unauthorized chunk load` (dev console) | Code called full warm-up outside authority — fix before merge |
| `navigation.chunk_load_unauthorized` log event | Same; wire is in `navigation-chunk-load-authority.ts` |
| `navigation.intelligent_warmup_skipped` reason `navigation_not_quiesced` | Expected during rapid switching |
| Long `Evaluate Script` in Performance tab | Route bundle parse — N4/N5 territory |

---

## File index

| File | Role |
|------|------|
| `navigation-performance-coordinator.ts` | Quiescence + rapid-nav mode |
| `navigation-chunk-load-authority.ts` | Dev/prod gate for full chunk loads |
| `intelligent-navigation-warmup-runner.ts` | Sequential idle warm-up |
| `route-navigation-warmup.ts` | Shell vs full modes; `resolveRouteNavigationWarmupMode()` (N4) |
| `app-shell.tsx` | Schedules warm-up; sidebar click path |
| `experiment-shell-policy.ts` | Instrumentation toggle |
| `persistent-app-chrome.tsx` | Single chrome instance |

**Last structural change:** 2026-06-03 — coordinator + authority + instrumentation off on experiment shell.
