# Hybrid Coordination Layer (Option B1)

## Goal

Improve real-world delivery reliability for invite-only micro-communities while keeping identity local-first and message content end-to-end encrypted.

## Non-goals

- The coordination layer does not store message plaintext.
- The coordination layer does not store private keys.
- The coordination layer does not provide global discovery.

## Responsibilities

### Invite rendezvous

- Create opaque invite tokens.
- Bind tokens to a recommended relay set.
- Allow redemption to return the relay set to the joining device.

### Relay negotiation (minimum viable)

- Return a deterministic relay set for a given invite so both peers subscribe and publish to at least one shared relay.

### Observability (future)

- Accept delivery receipts and surface debug-friendly status.

## Why this is needed

Pure relay-only messaging has failure modes that are hard to debug and often look like total failure.

Examples:

- Sender publishes to relays that the recipient is not subscribed to.
- The recipient is offline or backgrounded in a PWA.
- Mixed support for DM formats (legacy NIP-04 vs NIP-17 gift wrap).

## Security posture

- All sensitive state remains per-identity on device.
- Invite tokens are opaque; they should not contain secrets in query params.
- Tokens should be short-lived and redeemable once or a limited number of times.

## Minimal API shape

- POST /invites/create
- POST /invites/redeem

## Data stored

- Invite token hash (never store the raw token)
- Inviter public key
- Relay set JSON
- Optional community label
- Expiration timestamp

