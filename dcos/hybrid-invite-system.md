# Hybrid Invite System (PWA + Coordination Worker)

## Purpose

Make invite-based onboarding and first contact deterministic in production by introducing a minimal coordination layer that returns a shared relay set.

This specifically targets the most common “looks broken” failure mode in Nostr-style messaging:

- The inviter publishes to relays that the joiner is not subscribed to.

The coordination Worker is **not** an identity provider and **does not** store message plaintext.

## Components

### PWA (Next.js)

- Generates invite links.
- Redeems invite tokens when a user opens an invite link.
- Applies relay hints returned by the Worker (adds relays to the local relay list).
- Opens a chat/request-first flow with the inviter.

Relevant runtime configuration:

- `NEXT_PUBLIC_COORDINATION_URL`

### Coordination Service (Cloudflare Worker + D1)

- Issues opaque invite tokens.
- Stores only a hash of the token.
- Binds tokens to:
  - inviter public key
  - recommended relay set
  - optional label
  - expiration
- Redeems tokens to return:
  - inviter public key
  - relay set

### Nostr Relays

- Carry the actual messaging events.
- The Worker does not proxy messages.

## High-level flow

### 1) Create invite (Inviter)

1. User selects “Create invite link” in the PWA.
2. PWA collects the inviter’s current enabled relay list.
3. PWA calls the coordination service:

- `POST /invites/create`

Request (shape):

- `inviterPubkey`: inviter pubkey (hex)
- `relays`: array of relay URLs
- `ttlSeconds` (optional)

4. Worker:

- Generates random `token`.
- Hashes token (`SHA-256`) and stores the hash.
- Stores inviter pubkey + relays JSON + expiration.

5. PWA builds a share link:

- `/invite/{token}`

The token is treated as an **opaque handle**.

### 2) Open invite (Joiner)

1. Joiner opens `/invite/{token}`.
2. The invite route forwards `inviteToken` to the main shell.
3. After identity is available (unlocked), PWA redeems:

- `POST /invites/redeem`

Request (shape):

- `token`
- `redeemerPubkey`

4. Worker:

- Hashes incoming token and looks up invite by `token_hash`.
- Rejects if not found or expired.
- Inserts a redemption record (for basic auditability).
- Returns inviter pubkey + relay set.

5. PWA:

- Adds each returned relay URL to the local relay list.
- Sends a connection request to the inviter.
- Opens a chat with the inviter pubkey.
- Blocks normal messaging until the inviter accepts.

### 3) Messaging convergence

Once both peers share at least one relay, message delivery becomes deterministic relative to:

- relay availability
- client online/offline state
- DM kind compatibility (legacy kind `4` vs NIP-17 gift wrap kind `1059`)

## Data model (D1)

### invites

- `invite_id` (uuid)
- `token_hash` (sha-256 hex)
- `inviter_pubkey` (hex)
- `community_label` (optional)
- `relays_json` (JSON array)
- `created_at_unix_seconds`
- `expires_at_unix_seconds` (optional)

### invite_redemptions

- `redemption_id` (uuid)
- `invite_id` (foreign key)
- `redeemer_pubkey`
- `redeemed_at_unix_seconds`

## Security & privacy properties

- **No private keys**: the Worker never sees or stores private keys.
- **No plaintext**: the Worker never stores message plaintext.
- **Opaque tokens**: only a hash is stored server-side.
- **Replay considerations**:
  - Current MVP records redemptions but does not yet enforce single-use.
  - Recommended next step: enforce `max_redemptions` (default 1) or per-invite policy.
- **Enumeration resistance**:
  - Tokens should be long enough to make guessing impractical.

## Failure modes and expected UX

- **Worker down / unreachable**
  - Invite creation should fail visibly.
  - Invite redemption should fail visibly.
  - PWA can fall back to manual relay sharing and pubkey links.

- **Token expired**
  - Worker returns `expired`.
  - PWA should show an “Invite expired” state and prompt for a new invite.

- **Relay set is valid but relay is down**
  - Delivery can still fail.
  - Mitigation: include multiple relays and allow the user to add/replace relays.

## Observability (future)

Potential next additions (still minimal):

- Add `max_redemptions` and enforce it.
- Add optional “delivery receipt” endpoint so a client can report which relay(s) were used.
- Add basic “invite redeemed” timestamps to help debug onboarding.
