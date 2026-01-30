# Local E2E relay environment

This doc describes a deterministic local relay environment for development and Playwright E2E.

## Start the relay

Prereqs:

- Docker Desktop

Run:

```bash
docker compose -f docker-compose.nostr.yml up
```

The relay will be available at:

- `ws://localhost:7000`

## Configure the PWA to use the local relay

Set the following env var for the PWA server process:

- `NEXT_PUBLIC_E2E_RELAYS=ws://localhost:7000`

This overrides the default relay list in the UI to ensure deterministic tests.

## Running Playwright (local)

The messaging flow spec is guarded behind:

- `E2E_REAL_RELAY=true`

Example:

```bash
E2E_REAL_RELAY=true NEXT_PUBLIC_E2E_RELAYS=ws://localhost:7000 pnpm -C apps/pwa test:e2e
```

If you also want the test to assert message delivery (not just that sending UI works):

- `E2E_ASSERT_DELIVERY=true`
