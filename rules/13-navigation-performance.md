# 13 — Navigation Performance

**Canonical contract:** [`docs/program/navigation-performance-contract.md`](../docs/program/navigation-performance-contract.md)

Navigation freezes are **architecture regressions**, not one-off bugs. Unit tests are CI checkpoints only; they do not prove interactive performance and cannot memorialize every parallel path an agent might add.

## Non-negotiables

1. **One owner for navigation-side heavy work.**
   - `navigation-performance-coordinator.ts` decides when background chunk warm-up may run.
   - `navigation-chunk-load-authority.ts` is the only gate for full client-chunk imports during warm-up.

2. **User navigation beats background work.**
   - Never import route page clients on hover, focus, or pathname change.
   - Shell prefetch (`router.prefetch`) is allowed on intent; full chunk load only after quiescence.

3. **No parallel instrumentation on every route change.**
   - Transition overlays, mount probes, and stall watchdogs must stay behind `shouldRunNavigationInstrumentation()` (off for experiment/desktop shell builds unless explicitly re-enabled with contract update).

4. **Persistent chrome, thin routes.**
   - `PersistentAppChrome` + `useRegisterAppChrome` is the layout model; route bodies must not mount a second `AppShell`.
   - New sidebar routes must register via `createSidebarRoutePage` / `sidebar-routes.ts`.

5. **Network / invites request flows use the runtime transport owner.**
   - `useNetworkRequestTransport()` only — never `useEnhancedDmController` on those routes.

6. **Subtract before tuning.**
   - If navigation stalls return, list parallel paths first (warm-up, prefetch, provider hooks, route mount effects). Remove or defer — do not add another `useEffect` layer.

## Before merging navigation-adjacent changes

1. Read the contract doc (linked above).
2. Confirm no new chunk import on intent/pathname.
3. Run the **manual rapid-nav gate** in the contract (not optional for perf-sensitive PRs).
4. Update the contract **Owner map** if you add a new navigation-time code path.

## When stalls return

Follow [`rules/11-feasibility-and-modular-safety.md`](./11-feasibility-and-modular-safety.md): stop patch loops, run feasibility analysis, execute an N-series lane from the contract — do not re-enable full relay + warmup + instrumentation simultaneously.
