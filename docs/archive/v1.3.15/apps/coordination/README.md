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

wrangler d1 execute obscur_coordination --local --file=./migrations/0001_init.sql

3. Run the worker locally

pnpm -C apps/coordination dev

## Configuration notes

- The D1 binding name is `DB`.
- `wrangler.toml` contains a placeholder `database_id`. For local development this can remain `REPLACE_ME`.
- For deployment, create a D1 database and replace `database_id`, or use Wrangler to generate it.

## Endpoints

- GET /health
- POST /invites/create
- POST /invites/redeem

## D1

The schema lives in ./schema.sql
