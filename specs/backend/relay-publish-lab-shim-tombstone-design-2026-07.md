# Design — `relay-publish` #3 lab host-publish shim tombstone

**Status:** Implemented (L1) · 2026-07-30  
**Study:** [relay-publish-dual-owner-integration-study-2026-07.md](./relay-publish-dual-owner-integration-study-2026-07.md) §Subtract #3  
**Related:** [production-rewrite-and-devlab-tombstone-2026-07.md](./production-rewrite-and-devlab-tombstone-2026-07.md) · [relay-publish-legacy-quarantine-design-2026-07.md](./relay-publish-legacy-quarantine-design-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — relay-publish #3 lab shim tombstone
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab (already tombstoned)
CANONICAL OWNER:      publishTransportKernelToRelay on native (no host shim route)
PROOF BEFORE DONE:    transport-kernel-publish-port.test · relay-publish-owner.contract · W34/W50 defaults
OUT OF SCOPE:         Delete host-shim module · community publish · Rust engine_invoke · Dev Lab revival
```

---

## Problem

`shouldUseHostTransportPublishShim` / `Authority` require `isEngineLabStrictMode()`, which is **true whenever legacy is not opted in** — i.e. the production default. Combined with `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM=1`, product builds can take a second EVENT path.

Dev Lab is already tombstoned (`isDevLabEnabled() === false`). Host shims must follow.

---

## Change

AND host shim / authority gates with `isDevLabEnabled()`:

```ts
shouldUseHostTransportPublishShim =
  isDevLabEnabled() && isEngineLabStrictMode() && owner && SHIM env

shouldUseHostTransportPublishAuthority =
  isDevLabEnabled() && isEngineLabStrictMode() && owner && AUTHORITY env
```

Effect: product always routes kernel publish (or web legacy); harnesses that mock `shouldRouteHostTransportPublish` unchanged.

---

## Explicit non-goals

- Deleting `transport-kernel-host-publish-shim.ts`
- Changing W* harness mocks
- Community / freeze packages

---

## Proof

```text
pnpm -C apps/pwa exec vitest run \
  app/features/transport-kernel/transport-kernel-publish-port.test.ts \
  app/features/relays/services/relay-publish-owner.contract.test.ts \
  app/engine-lab/transport-engine-w34.contract.test.ts \
  app/engine-lab/transport-engine-w50.contract.test.ts
```

---

## Claim language

| May say | When |
|---------|------|
| Implemented (shim tombstone) | Gates always false on product + tests green |
| Fixed (publish) | Still needs L3 parity OK |
