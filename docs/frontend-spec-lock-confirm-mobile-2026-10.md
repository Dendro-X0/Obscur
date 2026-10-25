# Frontend spec — Lock confirm dialog mobile (2026-10)

## Surface

`AppLockConfirmDialog` → shared `ConfirmDialog` (`@dweb/ui-kit`), opened from avatar menu / security settings on phone preview and mobile shell.

## Problems (from screenshot)

1. Centered card with large icon + `px-8` padding feels cramped on a ~390×844 viewport.
2. Cancel + Lock sit side-by-side with `min-w-[11rem]` each, crowding the card and fighting the bottom tab bar visually.
3. Dialog does not use bottom safe-area inset (preview simulates insets via `--obscur-safe-area-inset-bottom`).

## Layout contract (mobile ≤ `sm`)

| Region | Behavior |
|--------|----------|
| Placement | Bottom sheet: dock `bottom-0`, full width, top corners only (`rounded-t-[24px]`) |
| Overlay | Keep existing Dialog overlay; content above tab bar (`z-[5001]`) |
| Header | Compact padding; slightly smaller icon |
| Actions | Full-width stacked column (`flex-col-reverse`: Lock primary on top, Cancel below) |
| Safe area | Bottom padding `max(1.25rem, env(safe-area-inset-bottom), var(--obscur-safe-area-inset-bottom))` |

## Desktop (`sm+`)

Unchanged centered card + horizontal action row.

## Out of scope

Lock/unlock auth flow; copy changes; non-confirm dialogs.
