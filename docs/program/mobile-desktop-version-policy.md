# Mobile ↔ Desktop version & feature parity policy

**Status:** Active  
**Applies from:** v1.5.4+ · **v2.0 gate:** [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md) Lane P  
**Related:** [strategic-direction.md](./strategic-direction.md), [mobile-ui-stack-evaluation.md](./mobile-ui-stack-evaluation.md), [manual-verification-environment.md](./manual-verification-environment.md)

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

## What we build before v2.0.0 (Lane P)

1. **Install path** — Android Studio build + **decentralized/local signing** (no purchased store certificates); install on emulator and at least one device.  
2. **Native shell parity** — icons, `versionName`, 16 KB page size where required.  
3. **Native components** — push decrypt, secure storage hooks, background policy (see mobile stack evaluation).  
4. **SQLite** — native persistence aligned with desktop; shared contracts, one migration owner per domain.  
5. **PWA / Web** — production shell (dev overlays off); same kernel as desktop.  
6. **Evidence** — extend demo matrices when mobile rows open; until then desktop A/B (Tester 1 dark / Tester 2 light) is authoritative.

Until **v2.0.0**: mobile on Release tags is **“same version, must be installable for smoke”** — not a separate product version line.

## Signing policy (testing)

| Approach | Status |
|----------|--------|
| Purchased Play/App Store developer certificates | **Not required** for program testing |
| Android Studio + local/debug or project keystore | **Canonical** test path |
| Decentralized / self-managed signing workflow | **Preferred** — document in Lane P closeout |

iOS production remains out of v2.0 gate unless explicitly chartered.

---

## Agent checklist on every `v1.5.x` tag

1. `pnpm version:check` green.  
2. Desktop + PWA + Android metadata aligned to tag version.  
3. CHANGELOG describes **user-visible** desktop/web changes; mobile notes labeled **preview / CI** if not production.  
4. Do not add mobile-only feature flags that bypass shared kernel without a documented contract.
