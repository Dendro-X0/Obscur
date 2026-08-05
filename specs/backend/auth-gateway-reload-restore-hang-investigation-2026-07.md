# Investigation — F5 refresh infinite “Restoring session…”

**Status:** Capture complete · fail-closed overlay fix (not AUTH-SESSION-1 revival)  
**Date:** 2026-07-28 (UTC)  
**Band:** AUTH-SESSION-1 remains **CANCELLED** — this slice only stops infinite loading

---

## Symptom

Manual refresh (F5 / WebView reload) stays on black screen: **Restoring session…** indefinitely.

## Root cause

`AuthGateway` shows the restore overlay when:

```ts
isNativeReloadRestoreInFlight || (reloadRestoreOverlayUntilUnixMs > Date.now())
```

`isNativeReloadRestoreInFlight` is true while:

- native + page reload
- `startupState.kind` is `pending` | `native_restorable`
- stored identity present
- not unlocked

It does **not** check `isAuthKernelBootRestoreSettled()`.

After boot restore finishes (success or fail), identity often remains `native_restorable` / locked-awaiting. Overlay never clears.

Additionally, React may not re-render when settle flips without identity/runtime state change.

## Policy

| Allowed | Forbidden |
|---------|-----------|
| Fail closed to locked auth shell after settle / hard timeout | Revive silent F5 unlock loops (AUTH-SESSION-1) |
| Bound overlay to boot settle + max ms | Patch auto-unlock credential paths |

## Fix

1. Gate overlay on `!isAuthKernelBootRestoreSettled()`.
2. Poll settle once per reload (do not re-arm on epoch) + hard-cap flag at `RELOAD_RESTORE_OVERLAY_MAX_MS` so UI always exits even when settle stays false / startup stays `native_restorable`.
3. `waitForAuthKernelBootRestore`: mark settled if still unsettled after wait budget.

## Proof

- L1: `auth-gateway.test.tsx` — overlay while unsettled; auth shell when settled + `native_restorable`; hard-cap exits after 2.5s when settle never flips
- L3: packaged F5 → login or unlocked shell within ~2.5s, never infinite restoring
