# Current Session Handoff

- Last Updated (UTC): 2026-05-18T22:40:00Z
- Session Status: **v1.5.6** — M1 code + tests green; emulator smoke pending
- Active Owner: Mobile shell + shared kernel (Lane M)

## Active Objective

1. **Product:** [v1.5.6-scope.md](../program/v1.5.6-scope.md) — DM-first layout in mobile shell.
2. **Roadmap:** [v1.5.x-feature-roadmap.md](../program/v1.5.x-feature-roadmap.md) — M1 primary; M2 next.
3. **Not blocking:** signing, Play Store, F-Droid.

## Next Atomic Step

Run **M1 emulator smoke** ([docs/assets/demo/v1.5.6/README.md](../assets/demo/v1.5.6/README.md)) on CI APK or `NEXT_PUBLIC_MOBILE_SHELL=1` Android build. Check off matrix, then tag v1.5.6 when `release:test-pack` is green.

## M1 in tree (ready to commit)

- Mobile shell: list ↔ thread via shared `Sidebar` / `ChatView` / `dmController`; `AppShell` `mobileDmMode`.
- `activeChatView` single definition; `syncStatusBanners` + `sidebarNode` shared.
- Tests: `main-shell.test.tsx` (mobile layout), `mobile-dm-thread-header.test.tsx`, `app-shell.test.tsx` (tab bar hidden).

## Shipped (v1.5.5)

- R1–R3, U2 — relay publish UX, projection recovery, vault cold open, settings relay banner.
- Tag `v1.5.5` on GitHub; Full Release CI green.

## Continuity references

- [v1.5.6-scope.md](../program/v1.5.6-scope.md)
- [v1.5.6-gate.md](../releases/v1.5.6-gate.md)
- [mobile-desktop-version-policy.md](../program/mobile-desktop-version-policy.md)
