# Testing without Docker (local + with a friend)

This doc describes how to validate core Obscur PWA flows when you cannot run a local relay via Docker.

## Option A: Use a public relay (fastest)

Pros:

- No local setup

Cons:

- Not deterministic
- Rate limits / relay outages can cause flaky tests

1) Pick 1-2 relays and use them consistently for both people and for E2E:

- Example relay list:
  - `wss://relay.damus.io`
  - `wss://nos.lol`

2) Run the PWA with relay override:

- `NEXT_PUBLIC_E2E_RELAYS=wss://relay.damus.io,wss://nos.lol`

3) Confirm basic connectivity:

- Open the app
- Go to Messaging and verify the UI shows “connected to relays” with `open > 0`

## Option B: Run a local relay without Docker (WSL)

If you have WSL2 available, you can run a relay inside WSL and connect to it from Windows.

High-level steps:

- Install WSL2 (Ubuntu)
- Run any Nostr relay implementation in WSL (for example, a Rust relay)
- Expose it on a port (e.g. `7000`)
- In Windows, set:
  - `NEXT_PUBLIC_E2E_RELAYS=ws://localhost:7000`

## Playwright E2E (without Docker)

The real-relay messaging spec is guarded behind `E2E_REAL_RELAY=true`.

Run against public relays:

```bash
E2E_REAL_RELAY=true NEXT_PUBLIC_E2E_RELAYS=wss://relay.damus.io,wss://nos.lol pnpm -C apps/pwa test:e2e
```

If you also want the test to assert cross-user delivery:

```bash
E2E_REAL_RELAY=true E2E_ASSERT_DELIVERY=true NEXT_PUBLIC_E2E_RELAYS=wss://relay.damus.io,wss://nos.lol pnpm -C apps/pwa test:e2e
```

## Real-time interactive test with a friend (recommended checklist)

Do this with BOTH of you using the SAME relay list via `NEXT_PUBLIC_E2E_RELAYS`.

1) Identity

- Create an identity
- Copy your public key

2) Search

- Search for your friend’s public key
- Verify the “Open DM” action becomes enabled

3) Create chat

- Open DM with your friend

4) Messaging

- Send a short text message
- Friend confirms receipt
- Friend replies
- You confirm receipt

5) Attachments

- Send a small image
- Friend confirms they can see/download it

6) Regression check (persistence)

- Refresh the page
- Confirm the chat list and messages persist

Notes:

- If search returns “ghost accounts”, that typically means the relays you’re using are not returning actual profile events for that query (or you’re missing the friend’s pubkey). Use direct pubkey-based flows for verification.
- For messaging failures, check the relay status indicator first (must have at least one open connection).
