# Frontend spec — Local route loading overlap fix (2026-10)

## Problems (screenshots)

1. Progress bar sits on safe-area top and fights CLIENT SHELL badge + AppShell “OBSCUR” header.
2. `RouteWarmupSkeleton` uses translucent backgrounds (`/90`, `/40`) so real Network chrome and prior route titles (“Vault”) bleed through.
3. Local shell repeats “Obscur” brand chrome under the existing mobile header → double brand / clutter.

## Contract

| Element | Behavior |
|---------|----------|
| Local transition shell | Opaque `bg-background`; covers **content column only** (already under header); skeleton **compactChrome** (no second Obscur title) |
| Progress bar | Mobile: `top: var(--obscur-shell-progress-top)` = measured sticky header bottom (`0` if header hidden); `z` below experiment badges |
| When pathname matches target | Shell hidden (unchanged); bar may finish then hide |

## Out of scope

Removing experiment badges; Lane X re-enable.
