# Investigation: Relays Save deselects Advanced options (2026-08)

**Status:** Active — dogfood still on pre-fix exe  
**Surface:** Settings → Relays → Team workspace  
**Date:** 2026-08-21 / 2026-08-22

## Evidence

After **Save & use for new teams**, Advanced checkboxes the user had selected appear unchecked while the green success banner is shown.

## Root causes

1. **Stale packaged exe (2026-08-22):** `pnpm desktop:build:exe` was interrupted during TypeScript (`exit_code: unknown`). Release exe mtime remained `Aug 21 06:55` — dogfood never loaded the persist-flags patch.
2. **Prior apply path:** `handleApply` wrote `skipRelay=false` and `setTestWithoutRelay(false)` when a Workspace Relay URL was filled — cleared UI + storage.
3. **Lab bootstrap:** `reconcileLocalDevWorkspaceRelay` force-disables `:7000` / `:8788` whenever any public remote is enabled — undoes Save `addRelay` for the operator workspace URL on next bootstrap pass.

## Contract

Save must persist Advanced flags as selected. Typed workspace URL still gets `addRelay`. Operator-saved workspace relay must not be force-disabled by lab bootstrap while remotes stay enabled.
