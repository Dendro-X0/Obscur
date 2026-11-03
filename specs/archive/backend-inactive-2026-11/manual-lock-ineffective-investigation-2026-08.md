# Investigation — Manual Lock ineffective (2026-08)

## Symptom

Confirm **Lock Obscur?** → click **Lock** → profile does not lock (settings / shell remain usable). Blocks Segment B demo recording.

## Allowed

Handoff PAUSED dialect — **critical regression fixes** allowed.

## Mental simulation

User unlocked on desktop → Settings/Profile → Lock confirm → expect lock screen / auth shell → unlock with passphrase.

## Root causes (evidence)

### A. `lockBoundProfileWindow` fails closed before identity lock

```ts
await runAuthKernelBoundProfileLock(ports, profileId); // lockSession — can throw
await lockAppSession({ lockBoundProfile: runtime.lockBoundProfile }); // lockIdentity
```

`lockSession` returns `authFailed("unsupported_runtime")` when `!hasNativeRuntime()`, or fails on empty/invalid profileId. `runAuthKernelBoundProfileLock` then **throws**, so `lockAppSession` / `lockIdentity` never run. Confirm stays open or appears to no-op (`void confirmLock()` swallows rejection in UI).

Canonical product lock must always lock the JS identity session; native clear is best-effort.

### B. Shell gate ignores locked identity while phase is `ready`

`isProfileWindowUnlockedForAppShell` returns `true` when `runtimePhase` is `activating_runtime|ready|degraded` **without** checking `identityStatus`. If identity becomes `locked` while phase briefly (or stuck) remains `ready`, AuthGateway keeps rendering children — lock looks ineffective.

## Fix plan

1. `lockBoundProfileWindow`: always run `lockAppSession` / identity lock; treat native `lockSession` as best-effort (log on failure, do not abort).
2. `isProfileWindowUnlockedForAppShell`: require `identityStatus === "unlocked"` + public key; never treat phase alone as unlocked.
3. L1: unit tests for shell gate + lock action ordering resilience.

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest: window-runtime-contracts + use-app-lock-action / bound lock |
| L3 | Manual: create identity → Lock Now → lock UI → unlock with passphrase |

## Non-goals

AUTH-SESSION revive · dialect · Tor · community
