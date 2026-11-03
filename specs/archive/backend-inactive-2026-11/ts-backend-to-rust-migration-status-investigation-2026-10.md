# Investigation — TS backend → Rust migration status

**Date (UTC):** 2026-10-15  
**Status:** B1–B10 landed · sole-maintainer Track B  

```text
HANDOFF ATOMIC STEP: Ask — Matrix Atom A (HS creds) · Tor T1 on capable net · or next product
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified · A4 tag until ask
CANONICAL OWNER: libobscur + Tauri engine_invoke (Rust) · TS engines thin only
PROOF: B10 remainder (random/verify) L1 + soak partial
```

## Goal (maintainer)

Migrate **server-side / kernel / durable** code that was TypeScript into the **Rust backend**, then **delete** the TS modules that the new Rust owners replace. UI stays TypeScript.

## Progress

| Slice | Result |
|-------|--------|
| B0–B1 | Transport legacy gone · DM write IPC tombstoned |
| B2–B3 | Fail-closed native crypto + generateKeyPair |
| B4–B7 | NIP-96 native-only · stub delete |
| B8 | Native group AES — L1 3+8 · cargo check ok |
| B9 | Native invite AES — [crypto-native-invite-aes-design-2026-10.md](./crypto-native-invite-aes-design-2026-10.md) · L1 2+9 · cargo ok |
| B10 | Remaining SubtleCrypto inventory — [crypto-subtlecrypto-inventory-b10-investigation-2026-10.md](./crypto-subtlecrypto-inventory-b10-investigation-2026-10.md) · L1 allowlist |
| B10→ | Native rumor event id — [crypto-native-rumor-event-id-design-2026-10.md](./crypto-native-rumor-event-id-design-2026-10.md) · L1 2+14 · cargo check ok |
| B10→ | Native invite sign/verify — [crypto-native-invite-sign-design-2026-10.md](./crypto-native-invite-sign-design-2026-10.md) · L1 2+15 · cargo check ok |
| B10→ | Native deriveSharedSecret — [crypto-native-shared-secret-design-2026-10.md](./crypto-native-shared-secret-design-2026-10.md) · L1 1+16 · cargo check ok |
| B10→ | Native random + event verify — [crypto-native-random-verify-design-2026-10.md](./crypto-native-random-verify-design-2026-10.md) · L1 3+17 · cargo check ok |

_Last updated: 2026-10-17T14:05:00Z_
