# Frontend spec — Desktop vs mobile layout separation (2026-10)

```text
HANDOFF ATOMIC STEP: Separate desktop/mobile messaging chrome templates (shell-gated)
PAUSED / CANCELLED: Soft L3 · video usable · Tor Verified · beta.1 feature creep
CANONICAL OWNER: shell-contract + SidebarListChrome split · AppShell mobileShellHeader
PROOF BEFORE DONE: desktop shell always chrome=desktop · L1 unit · no shared mobile-only JSX in desktop file
SURFACE: release desktop exe + mobile-preview / mobile shell
```

## Problem

Mobile Chats/Network chrome work (flush headers, underline tabs, compact pills) must not reshape the desktop three-pane shell. Shared components that branch on `variant` in one file invite cross-edits. Viewport `max-width` alone is not the product gate — **build shell** is.

## Contract

| Concern | Desktop product (`isDesktopShellProduct`) | Mobile product (`isMobileShellProduct`) |
|---------|-------------------------------------------|------------------------------------------|
| Messaging list chrome | `DesktopSidebarListChrome` | `MobileSidebarListChrome` |
| Compact secondary pages | **Never** (tier forced `desktop`) | phone/tablet via width |
| AppShell sticky brand header | Optional / route | Primary (mobileShellHeader) |
| Tab bar | Hidden (`isMobileShellProduct` only) | Shown (unless DM thread) |
| Bottom inset (`.pb-mobile-tab-bar`) | **Never** — `.desktop-mode` zeros inset vars | Only while tab bar visible |
| `.mobile-mode` / `.mobile-dm-shell` | Off | On |
| Call presentation | voice dock · video stage | voice dock · video fullscreen |

## Rules

1. **Shell first** — gate product chrome with `isMobileShellProduct()` / `isDesktopShellProduct()`, not CSS breakpoints alone.
2. **Separate templates** — mobile-only JSX lives under `*-mobile*` files; desktop under `*-desktop*` (or clear sibling modules). Do not grow a single `if (variant === "mobile")` blob for primary chrome.
3. **Width tiers** — `useMobileCompactLayout` may refine *within* mobile/web; on desktop shell product it always returns false.
4. **Inset matches chrome** — AppShell applies `.pb-mobile-tab-bar` / mounts `MobileTabBar` only when `isMobileShellProduct() && !mobileDmMode`. Viewport tier must not open a dead band on desktop.
5. **Desktop wins coupled chrome** — Until shells are fully decoupled, prioritize desktop layout when a shared rule conflicts (Android-only mobile is acceptable collateral).
6. **Release proof** — B2 / packaging uses desktop shell env; rebuild `apps/pwa/out` before smoke — source edits do not reach the static Tauri webview until `build:pwa-shell`.

## Out of scope

Voice fullscreen redesign · Soft L3 · re-skinning desktop Chats aesthetics beyond separation.

## Landed (2026-10-25)

| Artifact | Role |
|----------|------|
| `sidebar-list-chrome-desktop.tsx` | Desktop three-pane list chrome |
| `sidebar-list-chrome-mobile.tsx` | Mobile underline/pill chrome |
| `sidebar-list-chrome.tsx` | Thin dispatcher only |
| `resolve-messaging-list-chrome-variant.ts` | Shell-gated variant (not viewport) |
| L1 | variant resolver + desktop/mobile chrome tests |
| AppShell `mobileTabBarVisible` | `isMobileShellProduct() && !mobileDmMode` only |
| `.desktop-mode` zeros `--mobile-shell-bottom-inset` | CSS belt (stylesheet loads after Tailwind) |
| L1 | `app-shell.test.tsx` + `mobile-tab-bar.test.tsx` |

_Last updated: 2026-10-25T10:30:00Z_
