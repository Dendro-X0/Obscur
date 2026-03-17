# 09 Mobile Native Parity Matrix

_Last reviewed: 2026-03-17 (baseline commit 38a4968)._

## Canonical Owner Map

- Kotlin/Swift layers: adapter-only, transport shell.
- Rust (`libobscur`) owns:
  - secure key load/store contracts,
  - push decrypt logic,
  - background sync relay/decrypt evaluation.
- PWA/TS owns orchestration and diagnostics surfaces.

## Android vs iOS Parity

| Surface | Android | iOS | Expected parity |
| --- | --- | --- | --- |
| Secure key id | `mobile::default::nsec` | `mobile::default::nsec` | Same key scope contract |
| Push decrypt entry | `decryptPushPayloadForKey` | `decryptPushPayloadForKey` | Rust-owned decrypt path |
| Background sync entry | `backgroundSyncForKey` | `backgroundSyncForKey` | Rust-owned sync path |
| Missing secure key | Locked notification path | Locked notification path | Deterministic fail-closed |
| Adapter secret reads | Forbidden | Forbidden | No local secret reads |

## Fail-Closed Policy

- If secure key material is missing/unavailable:
  - adapters must not decrypt payloads locally,
  - adapters must not continue optimistic sync state updates,
  - UI/notification paths should surface locked state.

## Drift Guard Requirements

- Mobile adapter files must not contain placeholder/simulation behavior.
- Mobile adapter files must not read key material from app preferences/defaults.
- Android and iOS adapters must both reference key-scoped Rust contracts.
