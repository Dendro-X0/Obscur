# Frontend spec — Mobile profile switching (2026-10)

## Goal

Mobile shell must expose **same-device profile switch** (not Soft L3 dual-window). DemoUser ↔ Tester* without hunting Identity deep links.

## Entry points

| Surface | Behavior |
|---------|----------|
| AppShell sticky header (right) | Compact `UserAvatarMenu` — includes **Manage profiles** → `/profiles` |
| Settings mobile home (top) | Current-account card → `/profiles` (and Identity for in-settings switcher) |
| `UserAvatarMenu` | Link **Manage profiles** → `/profiles`; Lock / Logout unchanged |
| Identity settings | Existing `ProfileSwitcherCard` (unchanged owner) |

## Not in scope

Soft L3 concurrent windows · Matrix · inventing new profile registry APIs.

## Proof

L1: component tests for entry + menu link. L2: Settings → card / header avatar → `/profiles` → Switch → reload as other profile.
