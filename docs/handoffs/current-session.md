# Current Session Handoff

- Last Updated (UTC): 2026-05-18T10:00:00Z
- Session Status: **v1.5.4 shipped** (`v1.5.4` tag) — **v1.5.5** active (mobile production)
- Active Owner: Mobile signing + device matrix

## Active Objective

1. **v1.5.5:** Signed Android APK + M1–M3 on device/emulator ([v1.5.5-scope.md](../program/v1.5.5-scope.md)).
2. **Version:** `1.5.5` on `main` (development).
3. **Policy:** [mobile-desktop-version-policy.md](../program/mobile-desktop-version-policy.md).

## What is true now

- **v1.5.4:** Tag `v1.5.4` pushed; GitHub Release workflow should build desktop + preview APK.
- **Desktop:** Production lane for users; download `.exe` / `.dmg` / `.AppImage` from Release.
- **Mobile preview:** Same-tag APK is CI parity; not marketed as production until v1.5.5.

## Next Atomic Step

1. Watch **Actions → Obscur Full Release** for `v1.5.4`.
2. Configure Android keystore GitHub secrets (or maintainer sign script) for v1.5.5.
3. Run M1–M3; record in `docs/assets/demo/v1.5.3/mobile-verification.md`.

## Continuity references

- [v1.5.5-scope.md](../program/v1.5.5-scope.md)
- [v1.5.5-gate.md](../releases/v1.5.5-gate.md)
- [v1.5.4-release.md](../releases/v1.5.4-release.md)
