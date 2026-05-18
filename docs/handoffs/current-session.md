# Current Session Handoff

- Last Updated (UTC): 2026-05-18T08:00:00Z
- Session Status: **v1.5.4 in progress** — BRAND + WS-C + WS-D landed locally
- Active Owner: Desktop/web polish

## Active Objective

1. **v1.5.4** closeout: tag when gates green; user will download desktop installer.
2. **Mobile:** same version/kernel as desktop; production mobile deferred to v1.5.5+ ([mobile-desktop-version-policy.md](../program/mobile-desktop-version-policy.md)).

## What is true now

- **BRAND:** Icons unified (`pnpm icons:regenerate`); pending macOS/Linux visual on tag.
- **WS-C:** Relay dedupe + degraded/offline UI in chat + sidebar indicator.
- **WS-D:** Composer footer uses `NEXT_PUBLIC_APP_VERSION`; Android `tauri.properties` synced to 1.5.4 / 10504.
- **Version:** `1.5.4` on main (development).

## Next Atomic Step

1. Run `pnpm release:test-pack` locally or in CI.
2. Tag `v1.5.4` when green; verify Release assets (icons + version).

## Continuity references

- [v1.5.4-scope.md](../program/v1.5.4-scope.md)
- [v1.5.4-gate.md](../releases/v1.5.4-gate.md)
