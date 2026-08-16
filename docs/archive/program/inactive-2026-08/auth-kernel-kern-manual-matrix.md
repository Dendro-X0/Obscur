# Auth Kernel — KERN manual matrix (Phase B)

**Status:** Headless contracts landed for all rows; manual desktop soak is steward QA.  
**Automated gate:** `pnpm verify:auth-kernel-contracts`  
**Charter:** [obscur-auth-kernel-charter-2026-06.md](./obscur-auth-kernel-charter-2026-06.md) §7

Run on **desktop Tauri** builds with at least one profile that has a local identity and stay-signed-in consent enabled.

| Gate | Setup | Action | Pass criteria |
|------|--------|--------|---------------|
| **AUTH-KERN-1** | Unlocked chat; keychain present | F5 reload | Returns to chat without auth screen; no duplicate restore spinner hang |
| **AUTH-KERN-2** | Unlocked chat; keychain present | Lock → F5 | Auth screen; keychain preserved; one passphrase unlock restores chat |
| **AUTH-KERN-3** | Unlocked chat | Sign out (title-bar or avatar menu) → F5 | Auth screen; keychain empty; no silent auto-restore |
| **AUTH-KERN-4** | Two profile windows (different profiles) | Unlock each; F5 both | No cross-profile keychain/session leak; lease blocks duplicate account in second window |
| **AUTH-KERN-5** | Sybil tier C (or steward override) | Create identity repeatedly | PoW at configured difficulty; throttle message after budget exhausted |

## Sign-out surfaces (kernel port routing)

All product sign-out entry points should call `useAuthKernelSurfaceActions().signOutBoundProfileWindow`:

- Desktop title bar profile switcher
- PWA user avatar menu (web shell)

Lock entry points should call `lockBoundProfileWindow` (title-bar lock confirm → `useAppLockAction`).

## Failure triage order

1. `auth-kernel-boot-owner` settle / profile boot reconcile
2. `auth_boot_snapshot` wire (profile scope, keychain_present, restore_eligible)
3. Manual lock flag (`auth-kernel-manual-lock-state`)
4. Parallel legacy restore in `auth-gateway` (should be subtracted — boot owner only)

## Non-goals

- Browser remember-me token restore on desktop (policy forbidden)
- Cross-profile roster or member list parity (community band paused)
