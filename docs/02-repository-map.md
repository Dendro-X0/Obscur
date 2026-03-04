# Repository Map

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Monorepo Layout

```text
apps/
  pwa/            # Main product UI and messaging logic
  desktop/        # Tauri host + native bridge
  coordination/   # Cloudflare Worker for coordination flows
  relay-gateway/  # Relay gateway service
  website/        # Marketing/info site
packages/
  dweb-core/
  dweb-crypto/
  dweb-nostr/
  dweb-storage/
  libobscur/
  ui-kit/
docs/
scripts/
```

## Frequently Touched Paths

### Messaging

- `apps/pwa/app/features/messaging/components/`
- `apps/pwa/app/features/messaging/hooks/`
- `apps/pwa/app/features/messaging/services/`
- `apps/pwa/app/features/messaging/lib/`

### Groups/Communities

- `apps/pwa/app/features/groups/components/`
- `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`

### Settings

- `apps/pwa/app/settings/page.tsx`
- `apps/pwa/app/features/settings/services/privacy-settings-service.ts`

### Shared Storage/Crypto

- `packages/dweb-storage/src/indexed-db.ts`
- `packages/dweb-crypto/*`
- `packages/dweb-nostr/*`

## Workspace and Build Configuration

- Workspace: [`pnpm-workspace.yaml`](../pnpm-workspace.yaml)
- Root scripts: [`package.json`](../package.json)
- PWA scripts: [`apps/pwa/package.json`](../apps/pwa/package.json)
- Desktop scripts: [`apps/desktop/package.json`](../apps/desktop/package.json)

## Known Workspace Script Mismatch

Root scripts currently include `dev:api` and `build:api`, but the API app directory is not present in this workspace.

- Root scripts source: [`../package.json`](../package.json)
- Current apps: `apps/coordination`, `apps/desktop`, `apps/pwa`, `apps/relay-gateway`, `apps/website`

