# Verify — Decline / reconnect lifecycle (2026-11-06)

```text
L1: vitest request-transport-service · contact-request-legacy-orphan · use-peer-trust → Pass
L2: B Decline → A not TRUSTED / no Message · Remove → evidence cleared · Connect again → pending invite
```

## Claim language

- Implemented: decline unaccept + remove clears acceptSeen + declined wins over stale trust.
- Verified on desktop: after packaged cut + cold-run.
