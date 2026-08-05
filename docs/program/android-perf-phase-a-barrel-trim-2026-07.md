# Phase A — static barrel trim (Android-relevant)

**Date:** 2026-07-27  
**Status:** Implemented (static) — runtime Android proof still Phase B  
**Source:** CodaCtrl Perf explore (PWA/desktop yellow barrel obligations)

## Goal

Reduce hot-path bundle fan-out from barrel `index.ts` re-exports without changing product behavior. Targets Android/WebView startup where barrel evaluation is expensive.

## What changed

| Surface | Change |
|---------|--------|
| `@obscur/conduit-mesh` | Slim production `index`; add `/gateway` + `/testing` subpaths; `sideEffects: false` |
| `apps/relay-gateway` | Imports mesh HTTP helpers from `@obscur/conduit-mesh/gateway` |
| `@dweb/ui-kit` | Full component subpath `exports` map; PWA no longer imports package root barrel |
| `apps/pwa/app/components/ui/*` | Wrappers re-export from `@dweb/ui-kit/<component>` |
| `apps/pwa` feature files | ~142 files rewritten from `@dweb/ui-kit` → subpaths |
| `apps/pwa/.../desktop/utils` | Barrel no longer re-exports React hooks (hooks stay under `hooks/`) |
| `@dweb/auth` | `sideEffects: false` + expanded subpath exports; auth-kernel adapters use leaf contracts/ports |
| `invites/utils/index.ts` | Replaced `export *` wildcards with named exports |

## Out of scope (deliberate)

- `workspace-kernel` barrel — adjacent to PAUSED community band; leave for later charter
- Runtime Android / 4 GB device proof (Phase B — CodaCtrl confirm / interaction-probe)
- Rewriting every `@dweb/auth` type-only import off the barrel

## Proof run (this session)

```bash
pnpm -C apps/pwa exec vitest run app/features/auth-kernel/auth-kernel.contract.test.ts \
  app/features/auth-kernel/auth-kernel-registration-throttle.test.ts \
  app/features/auth-kernel/auth-kernel-kern-1.contract.test.ts \
  app/features/auth-kernel/auth-kernel-kern-5.contract.test.ts

pnpm -C apps/pwa exec vitest run \
  ../../packages/obscur-conduit-mesh/src/conduit-mesh.headless.test.ts \
  ../../packages/obscur-conduit-mesh/src/conduit-mesh.tor-policy.test.ts \
  ../../packages/obscur-conduit-mesh/src/w53-smoke-parity.harness.test.ts \
  ../../packages/obscur-conduit-mesh/src/mesh-http-gateway-handler.test.ts \
  ../../packages/obscur-conduit-mesh/src/conduit-mesh-relay-pool-runtime.test.ts \
  app/features/transport-kernel/conduit-mesh-settings-snapshot.test.ts \
  app/features/transport-kernel/conduit-mesh-nostr-ws-client.test.ts \
  app/components/ui/dialog.test.tsx
```

All listed suites **passed**.

## Next

1. `studio.output.sync modules=[perf]` then re-run Perf explore — expect yellow barrel counts down on `apps/pwa` / `apps/desktop`
2. Phase B: install v1.9.14 APK on 4 GB device + CodaCtrl confirm tier
