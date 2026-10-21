# Design — Matrix access-token login (SSO / Element)

**Date (UTC):** 2026-10-17  
**Status:** Landed  
**Parent:** [protocol-adaptation-matrix-c2-design-2026-10.md](./protocol-adaptation-matrix-c2-design-2026-10.md)

```text
HANDOFF ATOMIC STEP: Matrix access-token login (no password required)
PAUSED / CANCELLED: Soft L3 Fixed · remount · uncapped Quiet · Tor Verified · Olm E2EE
CANONICAL OWNER: matrix-cs-client · matrix-adapter · Protocols settings
PROOF: vitest matrix-cs-client + adapter + C2 contract; Settings token path
```

## Goal

SSO / Element users (e.g. `@dendro:matrix.org`) can import an **access token** into Obscur without setting a Matrix password.

## Flow

1. User pastes homeserver URL + access token (user id optional).
2. `GET /_matrix/client/v3/account/whoami` with `Authorization: Bearer <token>`.
3. On success, persist `MatrixSession` (same storage as password login).
4. Password login remains available.

## Mutate

1. `matrixWhoami` + `matrixLoginAccessToken` (validate then `writeMatrixSession`)
2. Settings Protocols: access-token field + submit
3. Soak script: `OBSCUR_MATRIX_ACCESS_TOKEN` path
4. L1 tests + C2 contract pin

## Non-goals

Olm · SSO browser redirect · Soft L3 · storing token outside profile-scoped localStorage

_Last updated: 2026-10-17T15:20:00Z_
