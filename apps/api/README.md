# Obscur API (Optional)

This is a small optional API used during local development.

- Runtime: Node.js
- Framework: Hono
- Default port: `8787`

## Development

From the repo root:

```bash
pnpm dev:api
```

## Build

From the repo root:

```bash
pnpm build:api
```

## Notes

The PWA can be configured to call the API via:

- `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:8787`)
