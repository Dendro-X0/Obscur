# Obscur (PWA)

This is the Obscur Progressive Web App (PWA), built with Next.js.

## Requirements

- Node.js **>= 20.11**
- PNPM

## Install

From the repo root:

```bash
pnpm install
```

## Development

From the repo root:

```bash
pnpm dev:pwa
```

Open `http://localhost:3000`.

## Environment variables

- `NEXT_PUBLIC_API_BASE_URL`
  - Optional.
  - Default: `http://localhost:8787`

For local development, create `apps/pwa/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

## Build

```bash
pnpm build:pwa
```

## PWA notes

- Manifest: `/manifest.webmanifest`
- Service worker endpoint: `/sw.js`
- Icons are served via route handlers (e.g. `/apple-touch-icon.png`).

## Deployment

- Vercel is the simplest option.
- For Netlify, this repo includes a `netlify.toml` in `apps/pwa`.
