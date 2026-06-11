# Obscur Coordination Service (Cloudflare Worker)

This service is a minimal coordination layer for Obscur.

It does not store message plaintext and does not participate in encryption.

## What it does

- Creates invite tokens that contain a recommended relay set.
- Redeems invite tokens to return relay configuration to the client.

## Local development

1. Install dependencies

pnpm install

2. Create the local D1 database schema

pnpm -C apps/coordination db:migrate

If you prefer using numbered migrations instead of the single schema file:

wrangler d1 execute obscur --local --file=./migrations/0001_init.sql

3. Run the worker locally

pnpm -C apps/coordination dev

**Windows cold start:** the first `wrangler dev` boot can take **2–4 minutes** before `http://127.0.0.1:8787/health` returns `{"ok":true}`. For faster iteration, keep coordination running in a dedicated terminal and use `pnpm dev:desktop:online` in another — the stack reuses a healthy worker instead of restarting it.

On Windows, `wrangler d1 execute --local` can hang after success; `dev` and `db:migrate` use `scripts/coordination-dev.mjs` to apply schema safely. Existing local D1 databases skip re-migration on startup. Re-apply after schema changes with `pnpm coordination:migrate` or `node scripts/coordination-dev.mjs --force-migrate --migrate-only`.

## Configuration notes

- The D1 binding name is `DB`.
- `wrangler.toml` contains a placeholder `database_id`. For local development this can remain `REPLACE_ME`.
- For deployment, create a D1 database and replace `database_id`, or use Wrangler to generate it.

## Endpoints

- GET /health
- POST /invites/create
- POST /invites/redeem
- GET `/communities/{communityId}/membership/head`
- GET `/communities/{communityId}/membership/deltas?since={seq}`
- POST `/communities/{communityId}/membership/delta` — signed join/leave/expel (no chat plaintext). **Path B B1 ACL:** self-attested join/leave; expel by bootstrap steward (first join at seq 1) only.

## D1

The schema lives in ./schema.sql

## Path B local matrix (K-M1 / K-M2)

Maintainer smoke for **Band B0** — two desktop profiles, one coordination worker:

| Step | K-M1 (profile A — steward) | K-M2 (profile B — member) |
|------|----------------------------|---------------------------|
| 1 | `pnpm -C apps/coordination dev` — wait for `GET /health` → `{"ok":true}` | Same worker (shared URL) |
| 2 | Copy `apps/pwa/.env.example` → `apps/pwa/.env.local`; set `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` | Same |
| 3 | `pnpm dev:desktop:online` (profile A) | Second instance / profile B |
| 4 | Settings → Relays: enable a **non–public-default** team relay (or use coordination-only dev flag for directory-only tests) | Same relay list |
| 5 | Create `managed_workspace` — blocked until `/health` is ok | Join via invite — same coordination + relay gates |

**Production builds** require live `/health` (`probedHealthy === true`); dev escapes (`assume-local`, coordination-only mode) apply only in non-production or when `NEXT_PUBLIC_OBSCUR_ALLOW_WORKSPACE_DEV_ESCAPES=true` is set explicitly for local maintainer testing.

Verify gates: `pnpm verify:path-b-b0` · worker steward ACL: `pnpm verify:path-b-b1-4`
