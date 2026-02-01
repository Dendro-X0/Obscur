# Project handoff (Obscur / dweb-messenger)

## Executive summary
Obscur is a local-first messaging app built on Nostr. The repository is a PNPM monorepo that primarily ships a Next.js PWA (`apps/pwa`) and a Tauri desktop wrapper (`apps/desktop`). A Cloudflare Worker (`apps/coordination`) is intended to provide a small coordination surface for cross-device invite redemption.

As of the current state:

- The PWA builds successfully.
- ESLint has **0 errors** when run in "errors-only" mode.
- The overall product goal (repeatable cross-device invite → request → DM and invite → group join → post) depends on external infrastructure (public relays + an optional coordination Worker + environment variables).

## Repo layout
- `apps/pwa`
  - Next.js PWA (primary UI and runtime).
  - Includes server routes under `app/api` (the repo previously had a separate API app; the root scripts may still reference it).
- `apps/desktop`
  - Tauri v2 wrapper. Runs a `beforeBuildCommand` that builds the PWA.
  - Requires `TAURI_BUILD=true` for static export.
- `apps/coordination`
  - Cloudflare Worker + D1. Endpoints:
    - `GET /health`
    - `POST /invites/create`
    - `POST /invites/redeem`

## Architecture (high level)
- **Identity**: local-first; private keys stay on device.
- **Transport**: Nostr relays.
- **DMs**:
  - Primary: NIP-17 (gift wrap).
  - Fallback: kind 4.
- **Groups**: NIP-29-style semantics for membership/roles and group timeline.
- **Invites**:
  - Intended: inviter creates an invite; joiner redeems; relay set converges; then request-first gating unlocks messaging.
  - Coordination Worker is used for token rendezvous + relay list convergence.

## Current primary blockers / friction points
- **Coordination Worker deployment**: requires Cloudflare configuration (D1 `database_id`, Worker name, CI settings). Without this, `NEXT_PUBLIC_COORDINATION_URL` cannot be set for production, and cross-device invite redemption is limited.
- **Root scripts mismatch**: root `package.json` still references `apps/api` scripts; `apps/api` may not be a valid package anymore.
- **Request-first connection model**: parts of the invite/contact request flow exist but some pieces remain local-only (see notes in `docs/CHANGES_AND_STATE.md`).

## Fast local verification commands
From repo root:

- PWA dev:
  - `pnpm dev:pwa`
- PWA build:
  - `pnpm -C apps/pwa build`
- Lint (errors only):
  - `pnpm -C apps/pwa exec eslint . --quiet`

## Deployment notes (for a future maintainer)
- Vercel deploy requires **non-export** Next.js output. Desktop requires **static export**. This is handled via conditional config using `TAURI_BUILD=true`.
- Coordination Worker deploy requires:
  - A valid D1 binding ID.
  - Cloudflare project/script name alignment.
  - Root-level `wrangler.toml` or explicit working-directory configuration.
