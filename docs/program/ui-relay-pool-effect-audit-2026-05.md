# UI relay-pool effect audit — 2026-05

**Scope:** `apps/pwa` — React hooks/components that depend on `useRelay().relayPool`  
**Mechanism:** [ui-effect-stability-policy.md](./ui-effect-stability-policy.md)  
**Trigger:** Recurring `Maximum update depth exceeded` (fixed in `SidebarUserSearch`); Phase 3 online increases relay snapshot churn

---

## Executive summary

| Tier | Count | Meaning |
|------|-------|---------|
| **P0** | 1 | Effect chain can loop (`setState` + unstable `relayPool` dep) — **fix immediately** |
| **P1** | 14 | Callback/`useMemo` churn or heavy effect re-runs on every connection tick — fix with `useRelayPoolRef` (batch 2 complete 2026-05-22) |
| **P2** | 8+ | Passes pool to hooks/controllers; stable if child uses ref pattern |
| **Fixed** | 3 | Sidebar search, global-dialog search, debounced search hook |
| **OK** | 5 | Already uses ref pattern correctly |

**Root cause (one mechanism):** `useEnhancedRelayPool` returns a new object when `connections` / `healthMetrics` snapshots change. Listing **`relayPool` (object identity)** in `useMemo` / `useEffect` / `useCallback` deps ≠ listing **`relayPool.connections` (intentional signal)**.

---

## P0 — Loop risk (effect + setState + pool identity)

| File | Pattern | Risk |
|------|---------|------|
| [`group-discovery.tsx`](../../apps/pwa/app/features/groups/components/group-discovery.tsx) | `fetchGroups` deps `[relayPool]` → `useEffect([fetchGroups])` calls `setIsLoading(true)` | **High** — re-fetches on every relay tick while discovery mounted |

**Remediation:** `useRelayPoolRef`; stable `fetchGroups` with `[]` deps; read pool from ref inside async work.

---

## P1 — Unstable pool in hook deps (churn / stale closures; fix in batch)

| File | Dep | Notes |
|------|-----|-------|
| [`use-global-search.ts`](../../apps/pwa/app/features/search/hooks/use-global-search.ts) | `[pool, …]` on `search` callback | **Fixed** — `useRelayPoolRef` |
| [`use-identity-resolver.ts`](../../apps/pwa/app/features/search/hooks/use-identity-resolver.ts) | `[relayPool, …]` on `resolve` | **Fixed** — `useRelayPoolRef` |
| [`use-invite-resolver.ts`](../../apps/pwa/app/features/invites/utils/use-invite-resolver.ts) | `[pool]` on `resolveCode` | **Fixed** — `useRelayPoolRef` |
| [`use-profile-publisher.ts`](../../apps/pwa/app/features/profile/hooks/use-profile-publisher.ts) | `[pool, …]` on `publishProfile` | **Fixed** |
| [`use-chat-actions.ts`](../../apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts) | `[relayPool]` | **Fixed** |
| [`settings-tab-panel-model.tsx`](../../apps/pwa/app/settings/settings-tab-panel-model.tsx) | `[pool]` on publish/invite callbacks | **Fixed** |
| [`global-dialog-manager.tsx`](../../apps/pwa/app/features/messaging/components/global-dialog-manager.tsx) | `[relayPool]` on create-group handler | **Fixed** |
| [`invite-member-dialog.tsx`](../../apps/pwa/app/features/groups/components/invite-member-dialog.tsx) | `[pool]` service init effect | **Fixed** (earlier batch) |
| [`use-community-membership-gossip.ts`](../../apps/pwa/app/features/groups/hooks/use-community-membership-gossip.ts) | `[relayPool]` | **Fixed** |
| [`use-presence-gossip.ts`](../../apps/pwa/app/features/network/hooks/use-presence-gossip.ts) | `[relayPool]` | **Fixed** |
| [`use-invite-relay-integration.ts`](../../apps/pwa/app/features/invites/utils/use-invite-relay-integration.ts) | `[pool]` subscribe effect | **Fixed** |
| [`use-contact-relay-overlap.ts`](../../apps/pwa/app/features/messaging/hooks/use-contact-relay-overlap.ts) | `[pool]` fetch callback | **Fixed** |
| [`group-join-dialog.tsx`](../../apps/pwa/app/features/groups/components/group-join-dialog.tsx) | `[pool]` transient relay | **Fixed** |
| [`group-management-dialog.tsx`](../../apps/pwa/app/features/groups/components/group-management-dialog.tsx) | `[pool]` name subscription | **Fixed** |
| [`use-sealed-community.ts`](../../apps/pwa/app/features/groups/hooks/use-sealed-community.ts) | `[params.pool]` publish callbacks | **Fixed** (`poolRef`) |
| [`use-account-sync.ts`](../../apps/pwa/app/features/account-sync/hooks/use-account-sync.ts) | `[params.pool]` backup/restore | **Fixed** (G6-2) |
| [`enhanced-dm-controller.ts`](../../apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts) | `[params.pool]`, `[params.pool.connections]` | Transport owner — uses **connections** intentionally for sync; review before changing |
| [`main-shell.tsx`](../../apps/pwa/app/features/main-shell/main-shell.tsx) | `useMemo(..., [relayPool])` dead `socialGraph` | **Remove** — unused (lint warning) |

**Remediation:** `useRelayPoolRef(relayPool)` + read `poolRef.current` inside callbacks; keep **`connections` signature** deps only when connection *state* should trigger logic.

---

## P2 — Pool passed through (child owns stability)

| File | Pattern |
|------|---------|
| `main-shell.tsx` | `useSealedCommunity({ pool: relayPool })` |
| `runtime-activation-manager.tsx` | Account sync hooks |
| `runtime-messaging-transport-owner-provider.tsx` | DM controller params |
| `group-home-page-client.tsx` | Sealed community + publish |
| `network-profile-view.tsx` | DM publish one-shot |
| `search-page-client.tsx` | Discovery page |
| `purge/page.tsx`, `leave/page.tsx` | Admin flows |

**Action:** Audit children when touched; prefer ref at boundary if child runs effects on `pool` identity.

---

## Already fixed (2026-05-22)

| File | Fix |
|------|-----|
| `sidebar-user-search.tsx` | `useDebouncedProfileSearch` |
| `global-dialog-manager.tsx` | `useProfileSearchServiceRef` |
| `use-profile-search-service-ref.ts` | Canonical service binding |
| `use-debounced-profile-search.ts` | Canonical debounced search |

---

## Already correct (reference implementations)

| File | Pattern |
|------|---------|
| [`use-relay-session-watchdog.ts`](../../apps/pwa/app/features/relays/hooks/use-relay-session-watchdog.ts) | `poolRef.current = pool` in effect; handlers use ref |
| [`use-community-leave-outbox-retry.ts`](../../apps/pwa/app/features/groups/hooks/use-community-leave-outbox-retry.ts) | `relayPoolRef` + `connectionsKey` for open count |
| [`relay-provider.tsx`](../../apps/pwa/app/features/relays/providers/relay-provider.tsx) | `relayPoolRef` for supervisor |
| [`experiment-relay-shell.tsx`](../../apps/pwa/app/features/relays/providers/experiment-relay-shell.tsx) | Stable `EXPERIMENT_NOOP_RELAY_POOL` |
| [`invite-member-dialog.tsx`](../../apps/pwa/app/features/groups/components/invite-member-dialog.tsx) | Handler debounce via ref — **service init still P1** |

---

## Recommended fix order

1. **P0** `group-discovery.tsx` (this audit batch)
2. **Dead code** `main-shell.tsx` `socialGraph` useMemo
3. **P1 settings** — `settings-tab-panel-model`, profile publisher
4. **P1 groups shell** — `use-chat-actions`, `global-dialog-manager`, membership gossip

---

## Ongoing guardrails

```bash
# Find pool in dependency arrays (manual review)
rg '\[.*\b(relayPool|pool)\b.*\]' apps/pwa/app --glob '*.{ts,tsx}'

# Run stability regression bundle
pnpm verify:phase3
```

Add ESLint custom rule (future): flag `relayPool` in `useEffect`/`useMemo` dependency arrays unless comment `// relay-snapshot-intent`.

---

## Sign-off

| Step | Date | Status |
|------|------|--------|
| Audit complete | 2026-05-22 | ✓ |
| P0 group-discovery fix | 2026-05-22 | ✓ |
| P1 search/resolver trio | 2026-05-22 | ✓ (`use-global-search`, `use-identity-resolver`, `use-invite-resolver`) |
| P1 batch (settings/groups shell) | 2026-05-22 | ✓ |
| P1 gossip + sealed-community + account-sync | 2026-05-22 | ✓ |
