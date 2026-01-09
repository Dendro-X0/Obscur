# Obscur

Obscur is a local-first Nostr messenger designed for small, invite-only micro-communities.

This repository is a PNPM workspace with:

- **PWA**: `apps/pwa` (Next.js)
- **API (optional, local dev)**: `apps/api` (Hono on Node)
- **Desktop (planned)**: `desktop` (Tauri v2 wrapper)

## Requirements

- Node.js **>= 20.11**
- PNPM (see `packageManager` in `package.json`)

## Install

```bash
pnpm install
```

## Development

### PWA

```bash
pnpm dev:pwa
```

Open `http://localhost:3000`.

### API (optional)

```bash
pnpm dev:api
```

The API dev server runs on `http://localhost:8787`.

## Environment variables

- `NEXT_PUBLIC_API_BASE_URL`
  - Optional.
  - Default: `http://localhost:8787`

For local development, you can create `apps/pwa/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

## Build

```bash
pnpm build:pwa
pnpm build:api
```

## Deployment

- **PWA**: Deploy `apps/pwa` to Vercel or Netlify.
- If you deploy without the API, ensure the UI behaves gracefully (features depending on API should be gated).

## Pre-deployment checklist

- Ensure environment variables are set:
  - `NEXT_PUBLIC_API_BASE_URL` (PWA)
  - `CORS_ORIGIN` (API)
- Run quality gates:
  - `pnpm run lint:pwa`
  - `pnpm -C apps/pwa build`
  - `pnpm -C apps/pwa test:e2e`
- Open Settings → Health:
  - API check should return OK
  - Relays should show at least 1 open/connecting when enabled

## Project notes

- The PWA includes a service worker endpoint (`/sw.js`) and a web manifest (`/manifest.webmanifest`).
- Branding assets live in `apps/pwa/public` (see `obscur-logo.svg`).
