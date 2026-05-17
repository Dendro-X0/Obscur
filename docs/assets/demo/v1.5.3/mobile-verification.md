# v1.5.3 — Android mobile verification

**Release:** v1.5.3 (mobile shell foundations)  
**Tester:** _______________  
**Date (UTC):** _______________  
**APK/AAB from CI:** _______________ (GitHub Actions → Release `v1.5.3` or branch workflow artifact)  
**Device / emulator:** _______________ (model, API level, physical vs emulator)  
**Build env:** `TAURI_SHELL_TARGET=mobile` / `NEXT_PUBLIC_MOBILE_SHELL=true`

> Browser narrow viewport is **not** sufficient for sign-off. Use a real device or Android emulator with the CI-built APK.

---

## Prerequisites

- [ ] Desktop maintainer has pushed a green CI build that includes the mobile shell lane.
- [ ] USB debugging enabled (physical device) or emulator image API 26+ available.
- [ ] Optional: second test identity for DM smoke (M5); can defer if blocked.

---

## M1 — Install APK from release artifacts

| Step | Action | Expected |
|------|--------|----------|
| 1 | Download `*.apk` from GitHub Release assets or CI artifact for this commit/tag. | Artifact matches tagged build. |
| 2 | Install on device (`adb install -r obscur-*.apk` or file manager). | Install succeeds without signature errors. |
| 3 | Launch app from launcher. | Splash → app shell loads; no immediate crash. |
| 4 | Force-stop and relaunch once. | Cold start stable (no crash loop). |

| Result | Pass ☐ | Fail ☐ |
|--------|--------|--------|
| **Notes** | | |

---

## M2 — Mobile shell chrome (no desktop title bar)

| Step | Action | Expected |
|------|--------|----------|
| 1 | On first screen after launch, inspect top chrome. | **No** desktop window title bar / updater strip (mobile shell hides them). |
| 2 | Rotate device or resize emulator (if applicable). | Content respects safe area; no overlap under status bar. |
| 3 | Open system back gesture / back button. | Predictable navigation (does not exit app unexpectedly from root). |
| 4 | Optional: `adb logcat` grep `MobileMode` / shell — confirm mobile bundle flag if logging enabled. | No desktop-only controls rendered. |

| Result | Pass ☐ | Fail ☐ |
|--------|--------|--------|
| **Notes** | | |

---

## M3 — Auth unlock → conversation list visible

| Step | Action | Expected |
|------|--------|----------|
| 1 | Fresh install or clear app data. | Lock / onboarding screen shown when no session. |
| 2 | Import or unlock an identity with existing local data (or create new). | Unlock succeeds locally without hanging spinner. |
| 3 | After unlock, land on main shell. | **Conversation list** (Chats) visible — not blank indefinitely. |
| 4 | Wait ≤10s on list without interaction. | No perpetual full-screen skeleton; list or empty state renders. |
| 5 | Background app 5s, return to foreground. | Session still unlocked; list still visible. |

| Result | Pass ☐ | Fail ☐ |
|--------|--------|--------|
| **Notes** | | |

---

## Extended matrix (best-effort for v1.5.3)

| # | Scenario | Pass | Notes |
|---|----------|------|-------|
| M4 | Open DM thread; send text message | ☐ | Requires peer/relay; document blocker if skipped |
| M5 | Background/lock screen → reopen (session persists) | ☐ | |
| M6 | Push notification (if FCM configured) | ☐ | N/A skip: _______________ |

---

## Failure triage (quick)

| Symptom | Likely area | Log hint |
|---------|-------------|----------|
| Crash on launch | Tauri/WebView init | `adb logcat \| grep -i obscur` |
| Desktop title bar visible | Wrong shell build (`mobile` flag) | Verify CI `TAURI_SHELL_TARGET=mobile` |
| Blank list after unlock | Identity/profile binding or hydration | Account projection / messaging provider logs |
| Install blocked | Signing / ABI mismatch | Use arm64-v8a APK on 64-bit device |

---

**Sign-off:** ☐ Android mobile-shell gate passed (M1–M3 required)  
**Blockers for v1.5.3 tag:** _______________
