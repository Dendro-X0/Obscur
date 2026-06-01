# v1.8.12 — Demo / manual verification matrix

**Release:** [v1.8.12-release.md](../../../releases/v1.8.12-release.md)  
**Gate:** [v1.8.12-gate.md](../../../releases/v1.8.12-gate.md)  
**Scope:** [v1.8.12-scope.md](../../../program/v1.8.12-scope.md)

**Prereq:** [android-p1-signing-runbook.md](../../../program/android-p1-signing-runbook.md)

---

## Test R12 — Release artifact parity

| Step | Actor | Pass criteria |
|------|-------|---------------|
| 1 | CI | Obscur Full Release `verify-artifacts` — desktop parity check passes (no `--skip-android` only) |
| 2 | Maintainer | Download release assets — **all** `Obscur_*` desktop + mobile files contain **1.8.12** |
| 3 | Maintainer | Install one desktop build → **About** shows **1.8.12** |

**Record:** `run_id`, `outcome=parity_ok|failed`, platform.

---

## Test P12 — Android P1 wrap-up

| Step | Actor | Pass criteria |
|------|-------|---------------|
| 1 | Maintainer | `pnpm verify:android-prerequisites` green |
| 2 | Maintainer | `pnpm build:android:debug:emulator` (or CI artifact) |
| 3 | Emulator | Install APK, unlock, reach main shell (no permanent error boundary) |
| 4 | Maintainer | Open one DM or community path; note mobile chrome issues for backlog |

**Automated helper (steps 1–2 + install/launch when a device is attached):**

```bash
pnpm p12:android-smoke -- --build --wait-device=180
```

Start an AVD first if needed (`emulator -avd <name>`). The script prints a **P12 maintainer record** block for the matrix below.

### P12 UX checklist (manual — step 4)

Full findings: [mobile-ux-audit.md](./mobile-ux-audit.md)

| Check | Pass |
|-------|------|
| Safe area — status bar / gesture nav not clipping header or tab bar | |
| Tab bar — Chats ↔ Settings navigation works | Fixed — bottom tab bar visible on chat list; hidden in thread (back returns to list) |
| **Touch scroll** — chat list and DM thread pan without dragging the scrollbar | **Retest** — hotfix: `mobile-scroll-region` + native scroll viewport in message list |
| One DM or community thread opens without crash | |
| Back gesture returns to list | |
| No critical FAB/banner overlap blocking taps | **Retest** — dev FAB hidden on mobile shell; banners capped at `28dvh` scroll |

### Maintainer record

| Field | Value |
|-------|--------|
| `run_id` | |
| `outcome` | `p12_ok` \| `p12_install_launch_ok` \| `failed` |
| `emulator_api_level` | |
| `apk_version` | **1.8.12** |
| `notes` | mobile chrome backlog items |

**Record:** `run_id`, `outcome=p12_ok|failed`, emulator API level.

---

## Regression (optional)

- [v1.8.11 desktop online](../../../program/desktop-online-reliability-2026-05.md) — quick DM nav on desktop if PWA/shell touched.
