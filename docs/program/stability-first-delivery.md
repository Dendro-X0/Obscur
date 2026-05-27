# Stability-first delivery (2026-05-26)

**Decision:** **Desktop is the primary development and QA surface.** Android builds are **wrap-up only** — final pass for mobile UI/UX, not a parallel debug loop.

Charter: [rules/11-feasibility-and-modular-safety.md](../../rules/11-feasibility-and-modular-safety.md) · Handoff: [current-session.md](../handoffs/current-session.md)

---

## Maintainer evidence (2026-05-26)

| Surface | Result |
|---------|--------|
| Desktop `pnpm dev:desktop:online` | Chats, DM thread, settings navigation — **no** `RootErrorBoundary` during exploration |
| Android emulator (debug APK) | Install + auth OK; post-login error boundary on **first restore / offline-relay** path (emulator-specific until reproduced on desktop) |

Do **not** block desktop feature work on Android-only crashes. Log Android issues; fix in wrap-up if still reproducible.

---

## Primary track — Desktop

**Canonical dev:**

```bash
pnpm dev:desktop:online
```

**Automated gates:**

```bash
pnpm verify:phase3
pnpm verify:stability
```

**Focus:** production reliability (cold start, nav, DM persistence, relay/account sync, coordination when environment allows) per [phase1-desktop-shell-gate.md](./phase1-desktop-shell-gate.md) · [phase2-desktop-dm-persistence-gate.md](./phase2-desktop-dm-persistence-gate.md) · [phase3-desktop-online-gate.md](./phase3-desktop-online-gate.md).

---

## Deferred track — Android (wrap-up only)

**Purpose:** Mobile shell UI/UX, safe-area, tab bar, install/signing proof — **not** daily iteration.

| When | Action |
|------|--------|
| Pre-release / milestone wrap-up | `pnpm build:android:debug:emulator` or universal debug |
| Mobile chrome / layout change | `node scripts/build-pwa-shell.mjs mobile` + one emulator install |
| Signing exercise | `pnpm build:android:release` once |

**Avoid:** `build:android:release` during active desktop development (4× Rust release targets, poor ROI).

Pipeline artifacts: [android-p1-signing-runbook.md](./android-p1-signing-runbook.md).

---

## Lane P1 status

| Item | Status |
|------|--------|
| Runbook + prereq + debug APK pipeline | **Done** |
| Emulator install + auth | **Done** (maintainer) |
| Full P1 smoke / stability sign-off | **Deferred** to final wrap-up (mobile UI/UX) |
| Release signing exercise | **Deferred** to wrap-up |

---

## Paused

- Android rebuild loops as a debugging strategy for desktop bugs.
- Treating emulator post-login crash as proof of desktop regression (not reproduced on desktop soak).
