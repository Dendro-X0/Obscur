# PWA build stabilization (Next.js)

## Goal

Get a clean production build for the PWA so that:

- `pnpm -C apps/pwa build` succeeds
- Playwright E2E can reliably run against the production `webServer` build

## Current status

- **Current build command**: `pnpm -C apps/pwa build`
- **Current state**: **Failing** (TypeScript compile step)

### Current top blocker

- **File**: `apps/pwa/app/features/main-shell/hooks/use-main-shell-state.ts`
- **Error**: `An object literal cannot have multiple properties with the same name.`
- **Detail**: duplicate key `setIsNewChatOpen` is returned twice in an object literal around line ~110.

## What was fixed recently

- **Stale/invalid imports** fixed by pointing to existing feature-first paths (examples):
  - Desktop hooks re-wired to `app/features/desktop/hooks/*`.
  - Relay hook imports re-wired to `app/features/relays/hooks/*`.
  - Invite utilities updated to import `cryptoService` from `app/features/crypto/crypto-service`.
  - Added missing/compat modules such as `app/lib/cn.ts` and `app/lib/i18n/config.ts`.

- **Comlink/async crypto return types** handled in multiple locations:
  - `cryptoService.generateInviteId()` treated as potentially async and awaited where used as a `string`.
  - `InputValidator.validatePublicKey` updated to await `cryptoService.normalizeKey` and `cryptoService.isValidPubkey`.

- **LocalStorage-backed compatibility hooks** added where broken re-exports existed:
  - `useRelayList`, `usePeerTrust`, `useRequestsInbox`, `useBlocklist`.

## Known recurring failure classes

- **Stale import paths**
  - Many imports still reference legacy paths (e.g. `../relays/*`, `../crypto/*`) instead of the feature-first locations under `app/features/*`.

- **Async worker proxy results**
  - Crypto service methods may return `T | Promise<T>`; call sites must `await` whenever the result is used as a concrete value.

- **Type mismatches between similarly named types**
  - Example: `Message` from `features/messaging/types` vs `features/messaging/lib/message-queue`.

- **ESLint warnings vs build blockers**
  - Tailwind “can be written as …” warnings are not build blockers.
  - The build is currently blocked by TypeScript errors.

## Next steps (recommended order)

1. Fix the current blocker in `use-main-shell-state.ts` (duplicate object key).
2. Re-run `pnpm -C apps/pwa build`.
3. Repeat until build is green:
   - Fix next TypeScript error or module-not-found.
   - Prefer changing imports to match the actual feature-first file locations.
   - Treat crypto worker calls as async at call sites.
4. Once build passes, run Playwright E2E against production build.

## Notes

- Desktop-specific logic should remain secondary until the PWA production build is stable.
- If a missing module is referenced, prefer fixing the import path first; only add compatibility shims when there is no existing implementation.
