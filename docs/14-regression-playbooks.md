# Regression Playbooks

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


This document provides quick diagnosis paths for common regressions.

## 1) Chat Scroll Lag / Jank

Likely files:

- `apps/pwa/app/features/messaging/components/message-list.tsx`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- `apps/pwa/app/features/messaging/lib/performance-monitor.ts`

Checks:

1. confirm `chatPerformanceV2` state.
2. inspect pending event backlog (`pendingEventCount`).
3. profile rerenders in message row path.
4. compare behavior in `next dev` vs production start.

## 2) Missing / Duplicate Messages

Likely files:

- `.../messaging/services/message-bus.ts`
- `.../messaging/hooks/use-conversation-messages.ts`
- `.../messaging/services/message-persistence-service.ts`

Checks:

1. verify id stability and dedupe behavior.
2. verify delete/update ordering in same flush window.
3. verify persistence flush on hidden/unload paths.

## 3) Group Message Rejections / Scope Mismatch

Likely files:

- `.../groups/hooks/use-sealed-community.ts`
- `.../relays/providers/relay-provider.tsx`

Checks:

1. confirm scoped relay URL normalization.
2. confirm event relay URL matches expected scope.
3. confirm community binding tags (`h`/`d`) match group id.

## 4) Media Upload / Playback Failures

Likely files:

- `.../messaging/lib/nip96-upload-service.ts`
- `.../messaging/lib/upload-service.ts`
- `.../messaging/lib/media-upload-policy.ts`
- `.../messaging/components/audio-player.tsx`
- `.../messaging/components/video-player.tsx`

Checks:

1. validate file size/type policy.
2. inspect provider fallback sequence.
3. verify attachment kind inference in message rendering.

## 5) Settings Flag Not Taking Effect

Likely files:

- `.../settings/services/privacy-settings-service.ts`
- consumers in messaging/groups hooks/components

Checks:

1. ensure save writes expected localStorage key.
2. ensure `privacy-settings-changed` event is emitted.
3. ensure consumers subscribe and refresh state.

## 6) Identity / Lock / Session Issues

Likely files:

- `.../auth/hooks/use-identity.ts`
- `.../auth/services/pin-lock-service.ts`
- `.../auth/services/session-api.ts`

Checks:

1. verify stored identity hydration path.
2. verify lock/unlock transitions.
3. verify desktop/native session handoff behavior.

## 7) Minimum Repro Template

When filing regression issues, include:

1. app/runtime (`pwa dev`, `pwa prod`, desktop).
2. feature flag state (`chatPerformanceV2`).
3. exact steps and expected vs actual behavior.
4. logs/stack traces and affected file references.
5. commit hash or release tag.
