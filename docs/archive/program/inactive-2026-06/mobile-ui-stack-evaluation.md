# Mobile UI stack evaluation (Obscur monorepo)

**Status:** Decision record for v1.5.x  
**Last updated:** 2026-05-17  
**Related:** [v1.5.3-scope.md](./v1.5.3-scope.md), [09-mobile-native-parity-matrix.md](../encyclopedia/09-mobile-native-parity-matrix.md), [product-layers-and-nostr.md](../architecture/product-layers-and-nostr.md)

---

## Problem

Obscur ships as a **monorepo**: shared `packages/*` kernel contracts and `apps/pwa/app/features/*` application logic, with **Tauri** wrapping the PWA for desktop and Android/iOS. The responsive PWA is **not** a substitute for a mobile product shell — browser DevTools cannot validate keystore, push, background sync, safe areas, or system back navigation.

We need a stack that:

1. Reuses **ClientGateway / profile-scoped** logic (no parallel mutation owners).  
2. Ships **Android (and later iOS)** from existing CI without a full UI rewrite first.  
3. Allows a **dedicated mobile UI** to grow incrementally (DM-first).  

---

## Options considered

| Option | Summary | Pros | Cons |
|--------|---------|------|------|
| **A. Tauri Mobile + mobile shell (WebView)** | Same Next static export; `NEXT_PUBLIC_MOBILE_SHELL`; native Kotlin/Swift adapters | Reuses 90% codebase; CI already builds APK; Rust bridge for crypto/push | WebView UX limits; JS thread for UI; not “fully native” feel |
| **B. Capacitor + PWA** | Wrap `out/` in Capacitor | Familiar to web teams | Second shell owner alongside Tauri; duplicate native bridges |
| **C. React Native / Expo** | New UI tree; share logic via `packages/*` only | True native widgets; store patterns | Large duplicate UI; FFI/bridge to Rust or reimplement crypto paths; longest lead time |
| **D. Flutter** | Greenfield UI + platform channels | Strong mobile UX | Lowest reuse of TS/React investment; two UI stacks |

---

## Decision (v1.5.x)

**Primary: Option A — Tauri Mobile + dedicated mobile shell in `apps/pwa`.**

| Layer | Owner |
|-------|--------|
| Kernel / contracts | `packages/*`, `@dweb/client-gateway` |
| Business logic | `apps/pwa/app/features/*` (no desktop-only assumptions) |
| Desktop shell | `NEXT_PUBLIC_DESKTOP_SHELL` + title bar / tray |
| Mobile shell | `NEXT_PUBLIC_MOBILE_SHELL` + `MobileModeProvider` + mobile layouts (v1.5.4+) |
| Native adapters | Tauri `gen/android`, `gen/apple` — **adapter-only** per parity matrix |
| Web | Vercel / PWA — responsive breakpoints only |

**Build entry:** `node scripts/build-pwa-shell.mjs [desktop|mobile|web]`  
**Android CI:** `TAURI_SHELL_TARGET=mobile` on `tauri android build`.

---

## When to revisit (not v1.5.3)

Re-evaluate **React Native** only if evidence shows WebView cannot meet:

- Acceptable scroll/composer performance on mid-range Android.  
- Reliable background message ingest + notification actions.  
- Store review requirements impossible in Tauri WebView.

Any RN pivot must keep **one kernel** in `packages/*` and **one gateway mutation path** — not a second DM implementation.

---

## Mobile UI delivery sequence (post MB-1)

| Phase | UI scope | Shared logic |
|-------|----------|--------------|
| v1.5.4 | Auth, unlock, conversation list, DM thread | `features/messaging`, `features/auth` |
| v1.5.5 | Settings (subset), push/deep link polish | `features/settings`, native adapters |
| v1.5.6+ | Network / communities mobile surfaces | `features/groups`, `features/network` |

Each phase: new route/layout under a dedicated mobile shell tree (planned under the PWA app), not a fork of services.

---

## Verification discipline

| Environment | Use for |
|-------------|---------|
| Browser narrow viewport | Layout iteration only |
| Android emulator + 1 physical device | Release gates (M1+) |
| Desktop Tauri | Regression — must not break desktop shell |

---

## Anti-patterns

- Inferring `isMobile` from CSS `@media` alone for product behavior.  
- Duplicating DM send/receive in Kotlin/Swift.  
- Adding Capacitor alongside Tauri without removing one shell.  
- Starting v1.6 recall UI before mobile MVP DM path is stable.
