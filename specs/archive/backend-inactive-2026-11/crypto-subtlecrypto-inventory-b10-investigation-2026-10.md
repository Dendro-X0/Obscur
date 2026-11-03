# Investigation — B10 remaining SubtleCrypto inventory

**Date (UTC):** 2026-10-17  
**Status:** Inventory complete · L1 allowlist landed · no migrate mutate in this slice  
**Parent:** [ts-backend-to-rust-migration-status-investigation-2026-10.md](./ts-backend-to-rust-migration-status-investigation-2026-10.md)

```text
HANDOFF ATOMIC STEP: B10 — inventory remaining browser crypto under NativeCryptoService
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
CANONICAL OWNER: NativeCryptoService (Tauri) · CryptoServiceImpl (browser/PWA)
PROOF: this inventory + L1 contract listing remaining crypto.subtle sites
```

## Goal

Catalog every remaining `crypto.subtle` / inherited browser-crypto path after B2–B9, classify each, and name the next subtraction candidate. **Do not** delete `CryptoServiceImpl` (browser still needs it).

## NativeCryptoService status (Tauri)

| Method | Authority | SubtleCrypto? |
|--------|-----------|---------------|
| `signEvent` / DM / NIP-44 / gift-wrap (sentinel) | Rust fail-closed | No (throws on native fail) |
| `signEvent` / DM / … (ephemeral hex key) | `super.*` JS | Via `@noble` / packages (gift-wrap wrap keys) |
| `generateKeyPair` | Rust fail-closed | No |
| `generateRoomKey` / group encrypt/decrypt | Rust fail-closed | No |
| `encryptInviteData` / `decryptInviteData` | Rust fail-closed | No |
| `deriveRumorEventId` (module helper) | **Still SubtleCrypto SHA-256** (+ FNV fallback) | **Yes** |
| Inherited: ~~`generateInviteId` / `generateSecureRandom` / `verifyEventSignature`~~ | **N** | Rust `generate_secure_random` + `verify_nostr_event` |
| `signInviteData` / `verifyInviteSignature` (sentinel / Tauri verify) | **N** | Rust `sign_invite_data` / `verify_invite_signature` · TS canonicalize |
| `deriveSharedSecret` (sentinel) | **N** | Rust `derive_shared_secret` (SHA-256 concat; not ECDH) |

## Classification legend

| Class | Meaning |
|-------|---------|
| **N** | Native-owned on Tauri (done) |
| **C** | Candidate migrate to Rust (product crypto / identity-adjacent) |
| **A** | Acceptable browser/local UX (at-rest UI, hashes, PoW) — keep SubtleCrypto |
| **P** | Shared package used by browser path — migrate only with package owner plan |
| **T** | Test-only |

## Inventory — `apps/pwa/app` (non-test)

| Site | Use | Class | Notes |
|------|-----|-------|-------|
| `features/crypto/crypto-service-impl.ts` | AES-GCM group/invite (browser), SHA-256 invite/shared | **A/P** (browser keep) | Tauri overrides group/invite/sign/verify/shared-secret; browser still SubtleCrypto |
| `features/crypto/native-crypto-service.ts` | `deriveRumorEventId` | **N** | Migrated to Rust `derive_rumor_event_id` (B10 preferred mutate) |
| `features/messaging/lib/message-queue.ts` | Local queue AES-GCM | **A** | Device-local queue, not relay authority |
| `features/messaging/lib/nip96-upload-service.ts` | SHA-256 content hash | **A** | Integrity hash for upload |
| `features/messaging/controllers/dm-event-builder.ts` | SHA-256 | **A/C** | Event id helper — prefer align with Rust rumor id later |
| `features/messaging/controllers/v2/dm-send-pipeline.ts` | SHA-256 | **A/C** | Dedup/hash helper |
| `features/messaging/services/dm-delete-target-derivation.ts` | SHA-256 | **A** | Local derivation |
| `features/storage/services/storage-envelope-v1.ts` | AES-GCM + SHA-256 | **A** | Local storage envelope |
| `features/storage/services/profile-data-key.ts` | PBKDF2 / deriveKey | **A** | Local profile key |
| `features/auth/services/pin-lock-service.ts` | PBKDF2 + AES-GCM | **A** | PIN lock UX |
| `features/auth/services/pow-key-generator.ts` | SHA-256 PoW | **A** | Browser PoW |
| `features/security/services/security-audit-log.ts` | AES-GCM + SHA-256 | **A** | Local audit log |
| `features/security/services/identicon-service.ts` | SHA-256 | **A** | UI identicon |
| `features/vault/services/local-media-store.ts` | SHA-256 | **A** | Local media digest |

## Inventory — `packages/` (shared)

| Site | Use | Class |
|------|-----|-------|
| `dweb-crypto` encrypt/decrypt private key, derive AES, argon2 import, mine-pow | Identity envelope / KDF / PoW | **P** / **A** |
| `dweb-nostr` create/verify event, nip04 | Browser Nostr path | **P** (Tauri uses native for identity sentinel) |
| `dweb-coordination-contracts` room-key-wrap / membership-delta SHA-256 | Coordination hashes | **P** / **A** |

## Recommended next mutate (after B10 preferred)

1. ~~**Preferred:** `deriveRumorEventId` → Rust~~ — **landed** ([crypto-native-rumor-event-id-design-2026-10.md](./crypto-native-rumor-event-id-design-2026-10.md))
2. ~~**Invite sign/verify**~~ — **landed** ([crypto-native-invite-sign-design-2026-10.md](./crypto-native-invite-sign-design-2026-10.md))
3. ~~**deriveSharedSecret**~~ — **landed** ([crypto-native-shared-secret-design-2026-10.md](./crypto-native-shared-secret-design-2026-10.md))
4. ~~**Remaining inherited random/verify**~~ — **landed** ([crypto-native-random-verify-design-2026-10.md](./crypto-native-random-verify-design-2026-10.md))
5. **Defer:** Package-wide `dweb-nostr` / identity envelope — browser still requires SubtleCrypto.
6. **Soak leftovers:** Atom A needs HS creds; Atom B T1 needs Tor-capable net (no Verified claim).

## Non-goals

- Deleting `CryptoServiceImpl`
- Soft L3 / uncapped Quiet / Tor Verified
- Matrix Olm E2EE

## Proof

- L1: `apps/pwa/app/features/crypto/subtlecrypto-inventory-b10.contract.test.ts` — allowlisted remaining sites

_Last updated: 2026-10-17T10:35:00Z_
