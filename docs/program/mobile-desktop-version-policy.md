# Mobile ↔ Desktop version & feature parity policy

**Status:** Active  
**Applies from:** v1.5.4+  
**Related:** [strategic-direction.md](./strategic-direction.md), [mobile-ui-stack-evaluation.md](./mobile-ui-stack-evaluation.md)

---

## Principle

Obscur ships as **one product** with **one version line** (`1.5.x`). Desktop/web and mobile draw from the **same monorepo kernel** (`apps/pwa`, `packages/*`, relay/account-sync contracts). **Mobile production release may lag desktop** while native shell work catches up — but **must not fork version numbers or feature truth**.

---

## Version synchronization (required)

| Surface | Source of truth | Mechanism |
|---------|-----------------|-----------|
| Monorepo | Root `package.json` `version` | `pnpm version:bump` + `pnpm version:check` |
| Desktop installers | `apps/desktop/src-tauri/tauri.conf.json` | `pnpm version:sync` |
| PWA / in-app label | `NEXT_PUBLIC_APP_VERSION` | `scripts/build-pwa-shell.mjs` at static export |
| Android metadata | `tauri.android.versionName` / `versionCode` | `pnpm version:sync` → `gen/android/app/tauri.properties` (build-time) |
| GitHub Release tag | `v1.5.x` | Single tag ships **all** artifacts for that commit |

**Rule:** Never publish “Obscur Mobile 1.0” while desktop is `1.5.4`. Tag `v1.5.4` means every built artifact claims `1.5.4` (even if mobile is not marketed as production-ready).

---

## Feature synchronization (shared kernel first)

| Layer | Desktop + mobile share | Mobile-specific (native) |
|-------|------------------------|---------------------------|
| Messaging, groups, sync, auth | `apps/pwa` features + `packages/*` | Push, keystore, background, OS permissions |
| UI | Same static shell via `TAURI_SHELL_TARGET=mobile` until dedicated mobile layouts | Tab bar, safe areas, future DM-first screens |
| Transport | ClientGateway, relay pool, account projection | Optional Tor/native relay bridge (existing Tauri plugins) |

**Rule:** Product behavior changes land in **shared services/hooks** first. Mobile-only UI wraps the same contracts — no second mutation owner for membership, DM send, or sync checkpoints.

---

## Release lanes (what “shipped” means)

| Lane | v1.5.4 expectation | User-facing “production” |
|------|--------------------|---------------------------|
| **Desktop/web** | Primary ship target; gates in [v1.5.4-gate.md](../releases/v1.5.4-gate.md) | Yes — installers on GitHub Release |
| **Mobile (CI artifact)** | APK/AAB may build on same tag for parity testing | **No** — not a production mobile release until mobile program gate |
| **Mobile (production)** | Deferred to **v1.5.5+** | Requires: signed APK, device matrix, native gaps closed per [mobile-verification.md](../assets/demo/v1.5.3/mobile-verification.md) |

Desktop release **must not wait** on mobile device smoke when mobile is in **artifact-only** mode.

---

## What we build before “mobile production”

1. **Native shell parity** — icons, `versionName`, signing, 16 KB page size where required.  
2. **Native components** — push decrypt, secure storage hooks, background policy (see mobile stack evaluation).  
3. **Dedicated mobile UI slices** — Auth → DM list → thread (incremental, not a second app).  
4. **Evidence** — M1–M3+ on real device/emulator with signed builds.

Until then: treat mobile APK on Release as **“same version, preview shell”**, not a separate product launch.

---

## Agent checklist on every `v1.5.x` tag

1. `pnpm version:check` green.  
2. Desktop + PWA + Android metadata aligned to tag version.  
3. CHANGELOG describes **user-visible** desktop/web changes; mobile notes labeled **preview / CI** if not production.  
4. Do not add mobile-only feature flags that bypass shared kernel without a documented contract.
