# Radical stability slice (2026-05)

Underground / few-test-account posture: prefer **subtraction** (one truth owner, stable effect deps) over patch loops on legacy Nostr paths.

## 1. Membership truth (default ON in dev)

| Control | Behavior |
|---------|----------|
| `community-radical-truth-policy.ts` | `isRadicalMembershipTruthEnforced()` — ON in non-production unless `NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH=0`; OFF in production unless `1` |
| Recovery | No `persisted_fallback` sidebar rows when enforced |
| Coordinator | No `persisted_fallback_backfill` when enforced |
| Diagnostics | `hiddenByRadicalTruthCount` on recovery pass |

**Tests:** `community-radical-truth-recovery.test.ts`; legacy recovery/coordinator tests stub `NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH=0`.

## 2. Relay pool effect stability (P0/P1)

**Root cause:** `useRelay().relayPool` is a new object each connection snapshot → `useCallback`/`useEffect` deps churn → render loops.

**Canonical hook:** `use-relay-pool-ref.ts` — stable ref; read `poolRef.current` inside callbacks.

| Area | Status (2026-05-22) |
|------|---------------------|
| Search | `use-profile-search-service-ref`, `use-debounced-profile-search`; sidebar + global new-chat |
| Discovery | `group-discovery.tsx` |
| Resolvers | `use-global-search`, `use-identity-resolver`, `use-invite-resolver` |
| Groups | `invite-member-dialog` |
| Shell | `use-chat-actions`, `global-dialog-manager` (create group), `use-profile-publisher` |
| Settings | `settings-tab-panel-model` (invite verify + scoped group publish) |
| Gossip / invites | `use-community-membership-gossip`, `use-presence-gossip`, `use-invite-relay-integration` |
| Groups / DM UX | `group-join-dialog`, `group-management-dialog`, `use-contact-relay-overlap` |
| God-hook publish path | `use-sealed-community` (`poolRef` on scoped publish + rotate key) |
| G6 account sync | `use-account-sync` |

**Policy:** [ui-effect-stability-policy.md](./ui-effect-stability-policy.md) · inventory: [ui-relay-pool-effect-audit-2026-05.md](./ui-relay-pool-effect-audit-2026-05.md)

**Gateway:** `community-message-author-evidence.ts` — shared author-evidence helper (non-owner imports).

**Still P2 / acceptable:** `useMemo` on `pool.connections` for display metrics; `useEnhancedDmController({ pool: relayPool })` passes live pool by design; `enhanced-dm-controller` uses `params.pool.connections` intentionally.

## 3. Verify

```bash
pnpm verify:stability
```

Runs `verify:phase3` plus client-gateway and transport boundary scripts.

## 4. Not in this slice (Lane K / god-file split)

- Force radical truth in production
- Split `use-sealed-community` / shrink `group-provider` parallel paths
- TransportPort-only feature wiring
- R1 DM single materialization owner

## 5. Maintainer runtime

- Dev communities: `NEXT_PUBLIC_OBSCUR_RADICAL_TRUTH=0` only if you need legacy persisted_fallback QA
- G6 manual: [phase3-desktop-online-gate.md](./phase3-desktop-online-gate.md) under `pnpm dev:desktop:online`
