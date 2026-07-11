# Obscur v2 — install and build guide

**Status:** Active (2026-07-04) · Phase 2 D2-5 · Phase 3 prerequisite  
**Audience:** Maintainers, demo hosts, release prep  
**Charter:** [obscur-v2-phase2-docs-charter.md](./obscur-v2-phase2-docs-charter.md)

One page for **how to run**, **how to package**, and **what to expect** — no contradictory install stories. Detailed runbooks remain in archive (linked below).

---

## Quick reference

| Goal | Command | Output / notes |
|------|---------|----------------|
| **Daily desktop dev** (relay + coordination) | `pnpm dev:desktop:online` | Tauri + static shell · CDP `:9230` |
| **Dual-profile MCP verify** | Same + open Tester2 window | CDP `:9231` · [obscur-dev-test-accounts.md](./obscur-dev-test-accounts.md) |
| **Relay only (external stack)** | Terminal 1: `pnpm dev:relay:docker` · Terminal 2: `pnpm dev:coordination` · Terminal 3: `pnpm dev:desktop:no-coord -- --skip-build` | Faster restarts; cold-kill does not take down relay |
| **Desktop installer (local)** | `pnpm desktop:package` | `release-assets/{windows,macos,linux}/` |
| **Desktop/mobile installers (CI)** | Push `v*` tag **or** Actions → **Obscur Full Release** | Artifacts on workflow run; publish via dispatch + `publish_release=true` |
| **Android debug APK (emulator)** | `pnpm build:android:debug:emulator` | Universal debug APK under `gen/android/.../debug/` |
| **Android prereq check** | `pnpm verify:android-prerequisites` | Non-destructive SDK/JDK/Rust check |
| **Release gates** | `pnpm release:test-pack` · `pnpm docs:check` | Before tag or Phase 3 sign-off |

**Product limits before demo:** [obscur-v2-known-limitations.md](./obscur-v2-known-limitations.md)

---

## Desktop — development

### Canonical full stack

```bash
pnpm dev:desktop:online
```

Starts coordination (or waits for external worker), relay check on `:7000`, static shell build when stale, then Tauri dev. Use for messaging, groups, and CodaCtrl client verification.

**Flags (common):**

| Flag / variant | When |
|----------------|------|
| `-- --skip-build` | Shell already built; faster relaunch after process kill |
| `pnpm dev:desktop:no-coord` | Coordination already running in another terminal |
| `pnpm dev:relay:docker` | Team relay on `ws://localhost:7000` (requires Docker) |

### Verification stack (no packaging)

```bash
pnpm dev:relay:docker          # if not already up
pnpm dev:coordination          # if not bundled in workspace stack
# Desktop with CDP — see CodaCtrl client_stack_preflight
```

Policy: [stability-first-delivery.md](./stability-first-delivery.md) — **desktop primary**; Android wrap-up only.

---

## Desktop — production installer (Phase 3)

### One command

```bash
pnpm desktop:package
```

Runs `version:sync` → `build:desktop` → copies bundles to `release-assets/`.

Production desktop shells embed **live relay transport** (`NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1` via `scripts/build-pwa-shell.mjs`). Offline-stub mode is dev-only (`pnpm dev:desktop` without `:online`).

**Checksum manifest:** [release-assets/manifest.json](../../release-assets/manifest.json) (SHA-256 + commit + version).

| Platform | Typical artifact |
|----------|------------------|
| Windows | `release-assets/windows/Obscur_*_x64-setup.exe` |
| macOS | `release-assets/macos/*.dmg` |
| Linux | `release-assets/linux/*.AppImage` |

**Flags:** `--skip-build` · `--skip-version-sync` · `--publish-channel` (requires signed updater artifacts)

### Signing policy (Phase 3 decision)

| Mode | Policy |
|------|--------|
| **Default now** | **Unsigned accepted** — [obscur-v2-phase3-signing-policy.md](./obscur-v2-phase3-signing-policy.md) (signed 2026-07-04) |
| **Optional later** | Minisign + update channel — see archived [local-signing-strategy.md](../archive/program/inactive-2026-06/local-signing-strategy.md) |

If build logs `Missing comment in secret key` but says **Continuing copy**, the installer under `release-assets/` is still usable — remove or fix `.env.signing.local`.

**Deep dive:** [local-desktop-packaging.md](../archive/program/inactive-2026-06/local-desktop-packaging.md)

---

## Android — debug and release (Phase 3)

Android is **wrap-up / Phase 3**, not daily iteration. Desktop verification (Phase 1) is authoritative for v2 product truth.

### Debug APK (first smoke)

```bash
pnpm verify:android-prerequisites
pnpm build:android:debug:emulator    # faster — one ABI
# or
pnpm build:android:debug             # universal debug
```

Install:

```bash
adb install -r apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk
```

Helper: `pnpm p12:android-smoke -- --build --wait-device=180`

### Release APK (local JKS — optional)

Requires env vars `TAURI_ANDROID_KEYSTORE_*` — **never commit** keystore or passwords.

```bash
pnpm build:android:release
```

**Deep dive:** [android-p1-signing-runbook.md](../archive/program/inactive-2026-06/android-p1-signing-runbook.md) · smoke rows: [android-p1-smoke-checklist.md](../archive/program/inactive-2026-06/android-p1-smoke-checklist.md)

### Mobile UI iteration without APK loop

```bash
pnpm dev:mobile-shell:online
```

Browser device mode — layout only; not a substitute for native Tier 1 smoke.

---

## Version alignment

Before any release-tracked build:

```bash
pnpm version:sync
pnpm version:check    # CI / pre-tag
```

---

## Phase 3 exit preview (not Phase 2 work)

| ID | Task | Doc |
|----|------|-----|
| P3-1 | Desktop package + checksum in `release-assets/` | This guide § Desktop installer |
| P3-2 | Signing policy signed or **unsigned accepted** | [local-signing-strategy.md](../archive/program/inactive-2026-06/local-signing-strategy.md) |
| P3-3 | Android APK path + Tier 1 re-run on packaged build if needed | Android sections above |

Queue: [obscur-v2-roadmap-2026-07.md](./obscur-v2-roadmap-2026-07.md) Phase 3.

---

## Contradictions resolved (D2-5)

| Old confusion | Canonical truth |
|---------------|-----------------|
| “Need GitHub Release to install desktop” | **Local** `pnpm desktop:package` → `release-assets/` |
| “Must sign before any desktop install” | **Unsigned default**; signing deferred per maintainer decision |
| “Android blocks desktop lane” | **No** — [stability-first-delivery.md](./stability-first-delivery.md) |
| “Phase 2 archive doc is daily entry” | **This guide** is active; archive runbooks are detail |
| “Cold restart = use same AIO terminal” | Prefer **split terminals** for relay/coordination vs desktop (CodaCtrl soak) |

---

## Archive reference (detail, not boot path)

| Doc | Topic |
|-----|--------|
| [local-desktop-packaging.md](../archive/program/inactive-2026-06/local-desktop-packaging.md) | NSIS troubleshooting, channel publish |
| [local-signing-strategy.md](../archive/program/inactive-2026-06/local-signing-strategy.md) | Minisign + JKS when resumed |
| [android-p1-signing-runbook.md](../archive/program/inactive-2026-06/android-p1-signing-runbook.md) | Full Android pipeline |
| [maintainer-distribution-policy.md](../archive/program/inactive-2026-06/maintainer-distribution-policy.md) | Distribution philosophy |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-04 | D2-5 — canonical install/build guide for Phase 2 exit |
