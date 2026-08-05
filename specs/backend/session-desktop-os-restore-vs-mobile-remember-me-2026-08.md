# Session UX — Desktop OS restore vs mobile Remember Me

**Date:** 2026-08-02  
**Status:** Product note (no policy flip)  
**Related:** AUTH-KERN-1 · cancelled AUTH-SESSION-1 · [relay warm-up investigation](./relay-warmup-readiness-honesty-investigation-2026-08.md)

---

## Locked decisions

| Surface | Behavior | Policy flags |
|---------|----------|--------------|
| **Desktop Tauri** | Cold/F5 unlock via **OS secure storage** (AUTH-KERN-1). Do not call this “Remember Me”. | `DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY = true` |
| **Mobile shell** | Device-trust **Remember me on this device** after unlock (friendly UX). | `SESSION_AUTO_UNLOCK_ENABLED` / `SESSION_CREDENTIAL_PERSISTENCE_ENABLED` (mobile-only) |
| **AUTH-SESSION-1** | Remains cancelled — no multi-path JS/Rust scatter revival. | — |

## Copy rules

- Desktop: “Stay signed in via OS secure storage” / restore without browser passwords.
- Mobile: “Remember me on this device” / refresh restore.
- Never imply desktop uses browser token Remember Me.

## Proof

`pnpm verify:session-persistence-policy` · AUTH-KERN-1 contract expects `PRODUCT_READY === true`.
