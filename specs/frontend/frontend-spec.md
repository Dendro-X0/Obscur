# Frontend spec — identifiable invite & profile labels

**Date:** 2026-10-11  
**Owner:** groups invite UI + desktop profile picker  
**Problem:** Invite Connections and empty-looking profile slots use “Unknown contact” / “Identity hidden” / “Profile slot” in ways that hide who the user is acting on. That is not privacy; it blocks invite selection and trust.

## Goals

1. Invite Connections rows always show an **identifiable** primary label: human name when known, otherwise compact pubkey preview (`abcdefgh…ABCDEFGH`). Never “Unknown contact”.
2. Remove always-on **“Identity hidden”** / **“Unnamed connection”** copy from invite pickers, Network Connections, connection profiles, and trust settings.
3. Network Connections / connection profile show the same hydrate path (metadata → DM label → discovery/resolved → lab seed → pubkey preview).
4. Profile picker cards with a bound account show name or pubkey preview — not a blank “Profile slot” when `hasStoredIdentity` / subtitle already knows the account.
5. Truly empty slots may still say “Profile slot” / “Needs setup”.

## Non-goals

- Changing peerTrust / connection-store privilege policy
- Hiding pubkeys from the account owner’s own UI

## Proof

- Unit: `invite-connection-display.test.ts`, `resolve-invite-connection-presentation.test.ts`, `lab-peer-display-seed.test.ts`, `desktop-profile-card-display.test.ts`
- Manual (experiment-online / soft-l3): Network Connections + Invite Connections show **Tester2** for pubkey `3db055b4…`; no “Identity hidden” line
- Profile picker empty slot stays Needs setup until that slot has a bound account (see investigation spec)

## Investigation

- [invite-profile-display-hydrate-investigation-2026-10.md](../specs/backend/invite-profile-display-hydrate-investigation-2026-10.md)
