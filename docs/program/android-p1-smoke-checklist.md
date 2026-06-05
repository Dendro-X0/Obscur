# Android P1 — smoke checklist (Lane P)

**Purpose:** Repeatable maintainer pass for **installable Android APK** smoke — build, install, cold start, and minimum product shell behavior. Use during **wrap-up** or before tagging a user-visible release; not a gate between desktop implementation slices.

**Canonical build/signing:** [android-p1-signing-runbook.md](./android-p1-signing-runbook.md)  
**Policy (2026-06-01):** **Release signing deferred** — use **debug APK** for Tier 0–1 functional smoke; Tier 3 release keystore before v2.0 demo only.  
**Broader mobile UX (batched):** [deferred-manual-verification-checklist.md](./deferred-manual-verification-checklist.md) §5  
**Policy:** [stability-first-delivery.md](./stability-first-delivery.md) — Android is wrap-up, not a desktop blocker.

**Last updated (UTC):** 2026-06-01

**Status (maintainer 2026-06-01):** Tier 1 manual rows **postponed** during active desktop development. Pipeline + checklist remain canonical for wrap-up; do not block desktop merges on emulator/device availability.

---

## When to run

| Trigger | Minimum tier |
|---------|----------------|
| First Android smoke on a machine | Tier 0 + Tier 1 |
| After mobile-shell / Tauri Android changes | Tier 0 + Tier 1 |
| Before user-visible release tag | Tier 0 + Tier 1 + Tier 3 (release signing once) |
| Mobile UX polish pass | Tier 2 (§5 deferred checklist) |

Desktop G6 online gates **do not** block this lane.

---

## Version alignment

Before recording results, confirm the monorepo version:

```bash
pnpm version:check
pnpm version:sync   # only when building
```

Expected `versionName` comes from root `package.json` (currently **1.8.14** on `main`). The smoke helper warns if the installed APK version drifts.

---

## Tier 0 — Automated (maintainer machine)

| # | Step | Command | Pass |
|---|------|---------|------|
| A-0 | Prerequisites | `pnpm verify:android-prerequisites` | `[ ]` |
| A-1 | Emulator debug build (optional) | `pnpm build:android:debug:emulator` | `[ ]` |
| A-2 | Install + cold start (device attached) | `pnpm p12:android-smoke -- --build --wait-device=180` | `[ ]` |

**Notes:**

- Start an AVD before A-2 if no hardware is connected (`emulator -avd <name>`).
- Use `--skip-install` to validate build only; use `--apk=<path>` to reuse an existing artifact.
- On success, the script prints a **P12 maintainer record** block — paste it into your session record below.

**Typical APK output:**

`apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`

**Fast web-only mobile layout check (no APK):**

```bash
pnpm dev:mobile-shell:online
```

Open `http://127.0.0.1:3340` with device toolbar — useful for layout regressions; **does not** replace Tier 1 native smoke.

---

## Tier 1 — P1 gate (manual, on device/emulator)

Complete after Tier 0 install/launch. These rows are the **P1 exit criteria** in the signing runbook.

| # | Check | Pass criteria | Result |
|---|--------|---------------|--------|
| P1-1 | **Cold start** | App opens without immediate crash or permanent error boundary | `[ ]` |
| P1-2 | **Auth surface** | Welcome / unlock screen renders; offline stub or online per build flags | `[ ]` |
| P1-3 | **Identity** | Create or unlock identity completes — no infinite spinner (>45s) | `[ ]` |
| P1-4 | **Main shell navigation** | Reach Chats list; open Settings; tab bar + back behave | `[ ]` |
| P1-5 | **One thread path** *(recommended)* | Open one DM or community thread; send or view one message without crash | `[ ]` |
| P1-6 | **Online relay** *(optional)* | With online mobile build: relay list or connection banner loads without provider throw | `[ ]` |

**Out of scope for P1 (defer):**

- Full community coordination matrix (G6-4)
- Two-client sealed chat soak
- Play Console / store upload
- Release APK sideload to physical device (Tier 3 covers signing exercise once)

---

## Tier 2 — Extended mobile UX (batched wrap-up)

Run when doing a dedicated mobile polish pass — not required for every desktop slice.

| Ref | Area | Doc |
|-----|------|-----|
| M-01 … M-10 | Auth, tab bar, scroll, safe area, DM path, FAB overlap | [deferred-manual-verification-checklist.md](./deferred-manual-verification-checklist.md) §5 |
| UX findings backlog | Historical audit items | [mobile-ux-audit.md](../assets/demo/v1.8.12/mobile-ux-audit.md) |

---

## Tier 3 — Release signing (once per maintainer machine)

Exercise **once** before shipping sideload/release artifacts. Keystore **never** in repo.

| # | Step | Pass |
|---|------|------|
| R-1 | Generate maintainer keystore (outside repo) | `[ ]` |
| R-2 | Build with `TAURI_ANDROID_KEYSTORE_*` env vars — `pnpm build:android:release` | `[ ]` |
| R-3 | `apksigner verify --verbose` on release APK | `[ ]` |

Details: [android-p1-signing-runbook.md](./android-p1-signing-runbook.md) § Release APK.

---

## Session record (paste after a pass)

```text
Date (UTC):
Git SHA:
Expected version (pnpm version:check):
Device: emulator API __ / physical __
Tier run: 0 / 1 / 2 / 3

--- P12 maintainer record (from p12:android-smoke) ---
run_id:
outcome:
apk_version_name:
device:
notes:

Tier 1:
  P1-1 cold start: Pass | Fail | Blocked —
  P1-2 auth: Pass | Fail | Blocked —
  P1-3 identity: Pass | Fail | Blocked —
  P1-4 navigation: Pass | Fail | Blocked —
  P1-5 thread path: Pass | Fail | Skipped —
  P1-6 online relay: Pass | Fail | Skipped —

Blockers / backlog:
```

---

## Exit criteria (Lane P1 row)

- [ ] `pnpm verify:android-prerequisites` passes on maintainer machine
- [ ] Debug APK builds via `pnpm build:android:debug` or `build:android:debug:emulator`
- [ ] APK installs on emulator (and one physical device when available)
- [ ] Tier 1 rows **P1-1 … P1-4** Pass
- [ ] Release signing steps documented and exercised once (keystore **not** in repo)

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | Initial canonical P1 smoke checklist — consolidates runbook rows, P12 helper, deferred §5 |
