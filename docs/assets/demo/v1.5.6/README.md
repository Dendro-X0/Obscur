# v1.5.6 verification

Mobile UI preview (M1): DM-first flow in Android emulator / mobile shell.

**Build env:** `TAURI_SHELL_TARGET=mobile` / `NEXT_PUBLIC_MOBILE_SHELL=1` (see [v1.5.3 mobile verification](../v1.5.3/mobile-verification.md) for APK install paths).

## M1 — DM-first slice

- [ ] Unlock / auth completes
- [ ] Conversation list visible and scrollable
- [ ] Open thread; messages render
- [ ] Hardware/browser back returns to list
- [ ] Send one outbound message (relay connected)

## M2 — Shell polish

- [ ] Tab bar clears system navigation / safe areas
- [ ] No horizontal overflow on narrow width

## Regression pointers

- Desktop: [v1.5.5 release notes](../../../releases/v1.5.5-release.md)
- Prior mobile matrix: [v1.5.3/mobile-verification.md](../v1.5.3/mobile-verification.md)
