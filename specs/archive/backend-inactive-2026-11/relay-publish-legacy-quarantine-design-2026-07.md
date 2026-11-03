# Design — `relay-publish` #2 legacy quarantine (native)

**Status:** Implemented (L1) · 2026-07-30  
**Study:** [relay-publish-dual-owner-integration-study-2026-07.md](./relay-publish-dual-owner-integration-study-2026-07.md) §Subtract #2  
**Clarify:** [relay-publish-dual-owner-clarify-design-2026-07.md](./relay-publish-dual-owner-clarify-design-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — relay-publish legacy quarantine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      transport-kernel path via publishToRelayStandalone (native)
PROOF BEFORE DONE:    transport-kernel-publish-port.test · relay-publish-owner.contract · relay-standalone-publish-port.test
OUT OF SCOPE:         Delete enhanced-relay-pool-legacy · community publish · lab shim tombstone (#3) · freeze packages
```

---

## Bug (dual path on native)

| Condition | Before | After |
|-----------|--------|--------|
| Web (`!hasNativeRuntime`) | Legacy pool publish | Unchanged |
| Native + transport-kernel authority | Kernel publish | Unchanged |
| Native + `NEXT_PUBLIC_OBSCUR_TRANSPORT_KERNEL=0` | **Legacy pool** (dual owner) | **Kernel publish** (quarantine) |

`shouldUseLegacyStandaloneRelayPublish` was `!isTransportKernelPublishOwner()`, so opting out of kernel authority re-opened the legacy EVENT path on Tauri.

---

## Change

```ts
// Before
shouldUseLegacyStandaloneRelayPublish = () => !isTransportKernelPublishOwner();

// After — legacy only on non-native (web PWA)
shouldUseLegacyStandaloneRelayPublish = () => !hasNativeRuntime();
```

Native always continues to kernel / host-shim / subtracted rehearsal branches in `relay-standalone-publish-port.ts`. Do **not** delete legacy module (web still needs it).

---

## Proof

```text
pnpm -C apps/pwa exec vitest run \
  app/features/transport-kernel/transport-kernel-publish-port.test.ts \
  app/features/relays/hooks/relay-standalone-publish-port.test.ts \
  app/features/relays/services/relay-publish-owner.contract.test.ts
```

---

## Claim language

| May say | When |
|---------|------|
| Implemented (quarantine) | Gate + tests green |
| Fixed (publish dual-owner) | Needs L3 parity OK evidence |
