# Security and Privacy Model

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Core Security Posture

- Local-first state with encrypted/private messaging primitives.
- Minimize metadata leakage in transport/event handling.
- Keep private key material device-local.

## Security-Relevant Areas

- Auth/identity handling: `apps/pwa/app/features/auth/*`
- Crypto services: `apps/pwa/app/features/crypto/*`, `packages/dweb-crypto/*`
- Nostr event and protocol handling: `packages/dweb-nostr/*`
- Relay/network policy and trust: `apps/pwa/app/features/network/*`, `apps/pwa/app/features/relays/*`

## Operational Security Guidance

- Do not relax verification checks for speed in hot paths.
- Treat relay-origin filtering and event scoping as correctness constraints, not optional logging concerns.
- When changing auth/session logic, verify lock/unlock and persistence behavior on both PWA and desktop runtimes.

## Related Docs

- [Runtime Architecture](./03-runtime-architecture.md)
- [Maintainer Playbook](./08-maintainer-playbook.md)
- [Threat Model and Security Checklist (v0.8.0)](./20-threat-model-and-security-checklist-v0.8.0.md)
