# Production surfaces and storage

## Product shells

| Surface | Role | Deployed to users |
|---------|------|-------------------|
| **Desktop** (Tauri) | Primary production client | Yes |
| **Mobile** (Tauri Android/iOS) | Primary production client | Yes |
| **PWA / web** (`apps/pwa`) | Dev and integration shell only | No |

The PWA bundle exists so agents and maintainers can run the same React feature modules in a browser during development. It must not be treated as a second production runtime. Prefer `NEXT_PUBLIC_DESKTOP_SHELL` / `NEXT_PUBLIC_MOBILE_SHELL` build flags and `hasNativeRuntime()` when branching behavior.

## Canonical storage

- **SQLite** is the only production database (per-profile workspace under the desktop/mobile data directory).
- Browser `localStorage` / `sessionStorage` in the PWA dev shell are not authoritative for production data contracts.

## Profile window account ownership (Chrome model)

- Each **profile window slot** (`default`, `profile-2`, …) may hold local data for **one account** at a time.
- Signing in with a **different** pubkey in that slot is **blocked** until the user:
  1. Opens **another profile window** (recommended), or
  2. **Clears** the slot, or
  3. **Exports** a workspace archive to disk, then clears, then signs in.
- Cross-slot `localStorage` migration on login is **disabled** when the window has an explicit profile scope.
- Unified backup **import** wipes the slot first, then restores (full replace).

Owner: `profile-slot-login-guard.ts`, `profile-slot-account-switch.ts`.

## Local save library (game-style backups)

- Each unified export to the data root also writes a small tagged sidecar: `*.obscur-save.json` (`obscur.local_save.v1`).
- Desktop scans **shallow, bounded** trees under:
  - `{dataRoot}/workspace-exports`
  - `{dataRoot}/profile-archives`
  - optional extra roots in `obscur.save_library.extra_scan_roots.v1` (localStorage, passed to native scan)
- Native command `desktop_scan_local_saves` prefers sidecars (fast), then peeks export headers (first 16KB only).
- Auth screen **Local save library** lists results; selecting a save stages import for the current profile window after matching login.

## Desktop multi-window boot

- **Owner:** `apps/pwa/app/features/profiles/services/desktop-window-boot.ts`
- **Rule:** Never block the React tree on native profile IPC (`resolveNativeWindowLabel`, `desktopProfileRuntime.refresh`).
- Scope is applied synchronously from the window label or last-known cache; native reconcile runs in the background.
- Secondary windows are revealed via `window_reveal_current` after boot; Rust may also apply a native failsafe reveal.

## Performance direction

Patching overlapping boot paths (bootstrap timeouts, duplicate refresh promises, per-consumer supervisor hooks) created regressions. New work should:

1. Subtract parallel owners before adding UI.
2. Keep one boot owner per window lifecycle.
3. Consider separate OS processes per profile window if WebView2 single-process limits persist.
