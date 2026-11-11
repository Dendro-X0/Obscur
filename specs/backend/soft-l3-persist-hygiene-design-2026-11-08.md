# Design — Soft L3 persist hygiene (exclusive mesh survives reload) (2026-11-08)

```text
Investigation: specs/backend/soft-l3-persist-hygiene-investigation-2026-11-08.md
PAUSED: Soft L3 Fixed · Tor · Matrix · Continuity · A4
Mandate: prod-first Default Stable boot remains cold/reset default
```

## Goal

When the user **Replace-and-applies** Local Dev Mesh (or another exclusive private-mesh pack), a hard reload must **not** silently re-enable Default Stable public remotes and force-off `:7000`.

This is **hygiene**, not Soft L3 Fixed (hung dial / unlock stampede remain out of band).

## Behavior

| Event | Today | Target |
|-------|-------|--------|
| Cold profile / empty list | Default Stable public boot | Unchanged |
| Apply Local Dev Mesh **Replace** | Exclusive `:7000` in storage | Unchanged |
| Hard reload after exclusive Soft L3 | Public enabled · `:7000` disabled | **Exclusive Soft L3 still sole enabled** (or public present but **disabled**) |
| Apply Default Stable / Enable public | Public path | Unchanged |
| Intentional “public + local” mix (non-loopback-only) | No mergePublicBoot | Unchanged |

## Options (pick one for implement slice)

### A — Sticky exclusive intent (recommended)

1. On Replace-apply of a preset with `category: private_mesh` and replace semantics, persist:
   - `obscur.transport.exclusive_preset.v1` = preset id (e.g. `local_dev_mesh`)
2. In `resolveLoadedRelayList`, if exclusive intent is set **and** stored enabled set matches that preset’s URLs (or is a subset of its relays), **skip** `mergePublicBootIntoLoopbackOnlyList`.
3. Clear exclusive intent when user applies a public/mixed pack, Enable All public, or manually enables a non-lab remote.

Pros: preserves prod-first merge for true lab leftovers; respects explicit Soft L3. Cons: new storage key; must clear on every exit path from exclusive.

### B — Merge public as disabled under exclusive intent

Same sticky flag; still merge Default Stable rows for discoverability but `enabled: false`. Skip lab force-off for the exclusive preset URL while intent holds.

Pros: Settings still shows public rows. Cons: reconcile must honor intent so remotes-disabled Soft L3 stays on.

### C — Narrow merge predicate only

Treat “exactly LOCAL_DEV_MESH_PRESET URLs” as intentional — skip merge without sticky key.

Pros: tiny. Cons: brittle if user adds a second loopback; no clear exit signal.

**Recommendation:** **A** (clear intent + skip merge). Optional later: B for Settings discoverability.

## Files (implement slice)

- `transport-preset-catalog-panel` / apply-pack confirm → write/clear exclusive intent
- `relay-transport-scope.ts` or small `transport-exclusive-intent.ts` — read/write/clear helpers
- `use-relay-list.ts` · `resolveLoadedRelayList` — conditional skip merge
- Tests: merge skipped when intent+exclusive list; merge still runs for loopback leftover without intent; clear intent when enabling public remote

## Explicit non-goals

- Soft L3 Fixed claim
- Changing Default Stable cold boot
- Hung-CONNECTING redial wiring
- Release NSIS CDP seam
- Auto-Docker start

## Proof

| Layer | Claim |
|-------|-------|
| L1 | Unit: exclusive intent skips merge; no-intent loopback still merges; clear on public enable |
| L2 | CDP: Apply Local Dev Mesh Replace → hard reload → storage still sole-enabled `:7000` (or public disabled) · UI Soft L3 active / lab pool usable |
| Fixed | Maintainer only after L2 + no soak regress on leave/invite/block Soft L3 path |

## Claim language

- May say after L1/L2: Soft L3 **persist hygiene Pass**
- Must not say: Soft L3 Fixed · Tor Verified
