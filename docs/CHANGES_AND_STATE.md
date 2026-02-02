# Changes and state (current snapshot)

This file captures concrete changes made during the most recent maintenance session and the current state of the repository from a build/lint perspective.

## Code health status
- `pnpm -C apps/pwa build`: **PASS**
- `pnpm -C apps/pwa exec eslint . --quiet`: **PASS** (0 ESLint errors)

Notes:
- `pnpm -C apps/pwa lint` still prints many warnings; errors were reduced to zero.

## Changes made

### 1) PWA build fix: relay pool subscribe typing mismatch
**Problem**: Next.js build failed with a TypeScript error in `apps/pwa/app/groups/[groupId]/page-client.tsx` due to `pool.subscribe` accepting a mutable `any[]` while callers passed `ReadonlyArray` filters.

**Fix**: Introduced a shared `NostrFilter` type and updated the relay subscription plumbing to use `ReadonlyArray` types and typed `NostrEvent` events.

Files:
- Added: `apps/pwa/app/features/relays/types/nostr-filter.ts`
- Updated: `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
- Updated: `apps/pwa/app/features/relays/hooks/subscription-manager.ts`

### 2) Lint error fixes
**Problem**: ESLint errors blocking `eslint --quiet`.

**Fixes**:
- Escaped an apostrophe in JSX.
- Converted a `let` to `const` where reassignment did not occur.

Files:
- Updated: `apps/pwa/app/features/messaging/components/trust-settings-panel.tsx`
- Updated: `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`

### 3) Root-level Wrangler config for Workers Builds
**Problem**: Cloudflare connected builds were running `npx wrangler deploy` from the repo root and failing to find the Worker entrypoint.

**Fix**: Added a root-level `wrangler.toml` that points to the worker entrypoint under `apps/coordination/src/index.ts`.

Files:
- Added: `wrangler.toml` (repo root)

Note:
- Deploy can still fail if `database_id` in the D1 binding is not set to a real Cloudflare D1 database ID.

## Current known deployment friction
- Cloudflare Workers Builds:
  - Requires valid D1 `database_id`.
  - CI may override the Worker name depending on Cloudflare project settings.
- Vercel:
  - Requires correct Next.js config for dynamic output (non-export) unless building for Tauri.

## Recommended next technical cleanup (optional)
- Remove obsolete root scripts referencing `apps/api` if the API app has been merged into the PWA.
- Reduce lint warnings over time (unused vars, `any` usage, and rule-specific React hooks warnings).

### 4) Search & Messaging Reliability Improvements
**Problem**: Users reported "Ghost" profiles (unsearchable), messaging failures where messages were sent but not received (due to missing relay overlap), and UI issues preventing connection requests.

**Fixes**:
- **Robust Profile Search**: Implemented HTTP fallback to `nostr.band` API in `profile-search-service.ts`. If relays don't support NIP-50, search now gracefully degrades to the API, merging results.
- **Receiver Gossip (Relay Discovery)**: Updated `enhanced-dm-controller.ts` to implement NIP-65 "Gossip" for the *receiver*. When sending a message or viewing a chat, the app now actively queries and connects to the *recipient's* read relays.
- **Real-time Chat Watching**: Added `watchConversation` method. When a user selects a chat in `MainShell`, the app dynamically connects to that peer's relays and re-broadcasts subscriptions, ensuring real-time message arrival.
- **Connection Request Reliability**: Added proper error handling to `sendConnectionRequest` (preventing silent failures) and fixed the disabled state of the "Connect" button in `NewChatDialog` to allow initiating requests with found users.
- **Relay Settings Access**: Updated `settings/page.tsx` to allow access to the **Relays** tab even when the identity is "Locked" (safe mode), provided the public key is known.
- **Transient Relay Fix**: Patched `enhanced-relay-pool.ts` to wait (up to 2s) for a socket to transition from `CONNECTING` to `OPEN` before giving up, fixing race conditions when adding new relays.

**Files Updated**:
- `apps/pwa/app/features/search/services/profile-search-service.ts`
- `apps/pwa/app/features/messaging/controllers/enhanced-dm-controller.ts`
- `apps/pwa/app/features/main-shell/main-shell.tsx`
- `apps/pwa/app/features/relays/hooks/enhanced-relay-pool.ts`
- `apps/pwa/app/settings/page.tsx`
- `apps/pwa/app/features/messaging/components/new-chat-dialog.tsx`
