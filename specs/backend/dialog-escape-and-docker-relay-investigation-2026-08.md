# Investigation: Esc navigates while dialog stays open + Docker relay disabled (2026-08)

**Status:** Active  
**Surface:** packaged desktop · Create Group / Relays Team workspace  
**Date:** 2026-08-21

## Evidence

1. **Esc:** `AppShell` Escape handler calls `history.back()` unless `[data-escape-layer="open"]` exists (`app-shell.tsx`). `CreateGroupDialog` / `NewChatDialog` custom overlays omit that attribute and do not call `onClose` on Escape → route changes, dialog state remains.
2. **Docker:** `infra-nostr-relay-1` listens on `0.0.0.0:7000`. Metrics show `ws://localhost:7000` **DISABLED**. Team Workspace Advanced has **Test without local Nostr relay** checked → Apply skips `addRelay` / enable. Coordination `:8787` was down at probe time (HTTP 000).

## Root causes

| Issue | Cause |
|-------|--------|
| Esc | Overlay missing escape-layer + dismiss handler; shell back wins |
| Docker “unavailable” | Profile list has host disabled; lab skip-relay short-circuits enable |

## Not causes

- Docker container crashed (it is up)
- Quiet public relays failing (orthogonal toast on damus)

## Next

Design slice: dismissable overlays + Save enables typed workspace relay even if skip was left on.
