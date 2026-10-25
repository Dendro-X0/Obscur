# Frontend spec — Local-first route loading (2026-10)

## Surface

Mobile tab bar + AppShell content column during Chats ↔ Network / Vault / Search / Settings.

## Problems

1. After tap, active tab may update but body stays on the previous route until Next commits → feels dead or network-bound.
2. Loading copy (“Preparing contacts…”) implies relay work gates the shell.
3. Progress UX / Lane X shells are globally disabled (`shouldEnableNavigationProgressUx === false`).

## Layout contract

| Region | Behavior |
|--------|----------|
| Content column | When nav loading is active and `targetPathname !== pathname`, show full-bleed `RouteWarmupSkeleton` for the **target** surface (`absolute inset-0 z-10`) |
| Skeleton chrome | Title = surface name; detail = on-device copy (“Opening from this device…”) |
| Top progress bar | Keep thin visible bar (already restored) |
| Tab bar | Unchanged optimistic pending styling |
| Desktop sidebar click | Same shell via shared `beginNavigation` |

## Copy

| Was | Becomes |
|-----|---------|
| Preparing contacts, trust graph… | Opening from this device… |
| Preparing encrypted storage… | Opening local vault… |
| Preparing preferences… | Opening settings on this device… |
| Preparing discovery tools… | Opening search on this device… |

## Out of scope

In-page LES grid loading; relay banners; Lane X re-enable.
