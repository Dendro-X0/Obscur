# UI effect stability policy (relay-bound search and similar)

**Status:** Active  
**Systemic program:** [ui-render-loop-systemic-program.md](./ui-render-loop-systemic-program.md) — **read before adding relay/window effects**  
**Last updated:** 2026-06-02  
**Trigger:** Recurring `Maximum update depth exceeded` from `SidebarUserSearch` after Greenfield / online relay work

---

## Problem

`useRelay().relayPool` returns a **new object reference** whenever the enhanced relay pool publishes a connection snapshot (connecting → open → health updates). Any component that does:

```typescript
const searchService = useMemo(() => new ProfileSearchService(pool, ...), [pool]);
useEffect(() => { setIsSearching(true); ... }, [searchService]);
```

will re-run the effect on **every relay tick**, synchronously call `setState`, and can hit React’s nested update limit.

This is not unique to search — the same anti-pattern affects any `useMemo`/`useEffect` keyed on `relayPool`, `relayList.state`, or other high-churn snapshots.

---

## Canonical pattern

| Do | Don't |
|----|--------|
| Bind pool via **ref** (`poolRef.current = pool`) | Put `relayPool` in `useMemo` / `useEffect` deps for service construction |
| Recreate services on **`publicKeyHex`** (identity) change only | `setIsSearching(true)` synchronously at effect start on unstable deps |
| Use **`useDebouncedProfileSearch`** / **`useProfileSearchServiceRef`** | Duplicate debounce+search effects per screen |
| Use **`useRelayPoolRef`** for publish/subscribe callbacks | Stack extra effects to “fix” races |

**Audit:** [`ui-relay-pool-effect-audit-2026-05.md`](./ui-relay-pool-effect-audit-2026-05.md) — repo-wide P0/P1/P2 inventory (2026-05-22)

**Owners:**

- `apps/pwa/app/features/relays/hooks/use-relay-pool-ref.ts`
- `apps/pwa/app/features/search/hooks/use-profile-search-service-ref.ts`
- `apps/pwa/app/features/search/hooks/use-debounced-profile-search.ts`
- `apps/pwa/app/features/runtime/services/window-runtime-binding.ts` — **single** identity/desktop → supervisor bind (mounted via `WindowRuntimeBindingOwner` in `AppProviders`)
- `apps/pwa/app/features/runtime/services/window-runtime-supervisor.ts` — `useWindowRuntime` / `useWindowRuntimeSnapshot` are **read-only** subscribers + action facades (no bind/sync `useEffect`)

**CI gate:** `node scripts/verify-react-stability.mjs` (wired into `pnpm verify:stability`)

**Migrated call sites (2026-05-22):**

- `sidebar-user-search.tsx`
- `global-dialog-manager.tsx` (New chat search)
- `group-discovery.tsx` (P0 loop fix)
- `invite-member-dialog.tsx` (service init — identity-scoped only)

---

## Regression tests

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/search/hooks/use-debounced-profile-search.test.ts \
  app/features/messaging/components/sidebar-user-search.test.tsx
```

---

## When adding new relay-bound UI

1. If work runs on relay snapshot changes, prefer **event subscription** or **supervisor snapshot** with deduped signatures — not React effects on pool identity.
2. If work is user-driven (search, publish), use ref-bound services + debounce hook.
3. If you see `Maximum update depth exceeded`, check DevTools stack for `useEffect` + `setState` under messaging/search/groups sidebars first.
