# Design — Web-legacy path removal (browser-pool EVENT subtract)

**Date (UTC):** 2026-08-04  
**Investigation:** [web-legacy-path-removal-investigation-2026-08.md](./web-legacy-path-removal-investigation-2026-08.md)

---

## Change

### A — `transport-kernel-publish-port.ts`

```ts
// Before — web PWA still EVENT-publishes via browser-pool
export const shouldUseLegacyStandaloneRelayPublish = (): boolean => !hasNativeRuntime();

// After — no browser-pool EVENT owner (Tauri + web harness)
export const shouldUseLegacyStandaloneRelayPublish = (): boolean => false;
```

Comment: production web disabled; localhost harness must use transport-kernel / mesh, not `relay-browser-pool-runtime` standalone.

### B — Contracts

Update expectations in:

- `transport-kernel-publish-port.test.ts`
- `relay-publish-owner.contract.test.ts`
- `product-publish-inject.contract.test.ts` (if it pins the old arrow)

### C — Explicit non-goals

| Do not | Why |
|--------|-----|
| W66 delete + thin port swap | Native invites → `STANDALONE_LEGACY_PUBLISH_BLOCKED` |
| Edit `groups/**` | PAUSED |
| Delete `relay-browser-pool-runtime.ts` | Still used for non-product / reliability surfaces; EVENT path only quarantined |
| Flip smoke sign-off to PASS for W66 | Separate maintainer commit after invite→mesh |

---

## Mental simulation

1. Desktop Soft L3: mesh `publishToUrls` — unchanged.  
2. Desktop invite send: `publishToUrlsStandalone` → kernel path (same as native today).  
3. Localhost web harness: standalone no longer opens browser-pool sockets — kernel path or fail honestly.  
4. Production web: still blocked by `NativeRuntimeGate`.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/transport-kernel/transport-kernel-publish-port.test.ts app/features/relays/services/relay-publish-owner.contract.test.ts app/features/relays/services/product-publish-inject.contract.test.ts` |
| L3 | Soft L3 optional — path owner unchanged for DM |

### Claim

| May say | When |
|---------|------|
| **Implemented** (browser-pool EVENT retired) | L1 green |
| Fixed (DB dual-authority) | Needs native evidence no IDB/chat-state authority — policy already; not this gate flip alone |
| Implemented (W66 deletion) | Later |

---

## Status

**Implemented** (browser-pool EVENT retired) — L1 Pass (`transport-kernel-publish-port` + owner/inject contracts)
