# Current Session Handoff

- Last Updated (UTC): 2026-05-17T12:00:00Z
- Session Status: **v1.5.2 shipped on GitHub** — active program **v1.5.3** (Stay Smooth + mobile foundations)
- Active Owner: Client perf/stability, mobile shell + Android CI

## Active Objective

1. **v1.5.3 Track A:** Vault index/cursor, search/settings deferral, one lifecycle P0 with test.
2. **v1.5.3 Track B:** Mobile shell contract landed; Android CI uses `TAURI_SHELL_TARGET=mobile`; device matrix M1–M3.
3. **Stack:** Tauri Mobile + dedicated mobile shell (see [mobile-ui-stack-evaluation.md](../program/mobile-ui-stack-evaluation.md)) — not RN in v1.5.3.

## What is true now

- **GitHub:** Obscur v1.5.2 released; tag `v1.5.2` on `55d2e684` (docs fix + CI typecheck commits).
- **v1.5.3 started (landed on main pending commit):**
  - `shell-contract.ts`, `MobileModeProvider`, `build-pwa-shell.mjs`
  - Layout hides title bar / updater on `NEXT_PUBLIC_MOBILE_SHELL`
  - Release workflow: `TAURI_SHELL_TARGET=mobile` for Android build
  - Program docs: `v1.5.3-scope.md`, gate, mobile verification matrix

## Open Risks Or Blockers

| Risk | Mitigation |
|------|------------|
| Browser mobile ≠ device mobile | Device matrix required before Android ship |
| Android still uses WebView UI until v1.5.4 | Document in release notes; DM-first mobile layouts next |
| Vault full-message scan | WS-A index work in v1.5.3 |

## Next Atomic Step

1. Commit v1.5.3 foundation (shell contract + docs) if not yet on `main`.
2. Implement Vault aggregation cursor/index (WS-A).
3. Run `pnpm release:test-pack`; fill `docs/assets/demo/v1.5.3/mobile-verification.md` on emulator/device.

## Continuity references

- [v1.5.3-scope.md](../program/v1.5.3-scope.md)
- [mobile-ui-stack-evaluation.md](../program/mobile-ui-stack-evaluation.md)
- [v1.5.3-gate.md](../releases/v1.5.3-gate.md)
- [strategic-direction.md](../program/strategic-direction.md)
