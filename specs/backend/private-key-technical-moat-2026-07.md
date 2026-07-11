# Plan — Private key technical moat (wallet-grade)

**Status:** Phase 1–6 **complete (6a)** (2026-07-10) · FIDO2 export step-up deferred  
**Band:** `KEY-MOAT-1` — **ACTIVE**  
**Parent charters:** [v1.9.8-portable-storage-and-encryption-charter.md](../../docs/program/v1.9.8-portable-storage-and-encryption-charter.md) · [obscur-auth-kernel-charter-2026-06.md](../../docs/program/obscur-auth-kernel-charter-2026-06.md)  
**Human layer (paired):** [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md)  
**Discovery slice (landed):** [discovery-friend-code-private-key-2026-07.md](./discovery-friend-code-private-key-2026-07.md)

---

## 1. Product intent

Obscur identity keys should meet a **crypto-wallet bar** for technical attack resistance:

| Goal | Meaning |
|------|---------|
| **Stolen disk ≠ stolen keys** | Offline attacker gets ciphertext + salt, not plaintext scalars |
| **Hashcat-resistant unlock** | Passphrase → key derivation uses **memory-hard, slow KDF** with per-profile salt |
| **Minimal secret exposure** | Private keys never normalized in search, chat, URLs, or casual export paths |
| **Honest limits** | Unlocked session (T8), malware, and social engineering are documented out-of-scope for this band |

**Non-goal:** Replace user judgment for passphrase choice or phishing — that is [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md).

---

## 2. Threat model

### 2.1 What attackers brute-force

| Asset | Attack tool | Feasible? | Moat response |
|-------|-------------|-----------|---------------|
| Raw 256-bit secp256k1 scalar | Hashcat / GPU | **No** (search space) | N/A — never store or transmit raw |
| **Passphrase** against stolen encrypted blob | Hashcat / GPU | **Yes** if KDF is fast or password weak | Argon2id + strength policy + rate limits |
| Single SHA-256(passphrase) | Hashcat | **Trivially yes** | **Forbidden** — never use alone |
| PBKDF2-SHA256 (200k) | Hashcat | Moderate on weak passwords | Migrate to Argon2id; tune cost |
| OS keychain entry (platform-gated) | OS exploit / malware | Platform-dependent | Wrap tokens; never long-lived plaintext nsec |

### 2.2 Scenarios (extends v1.9.8 T1–T8)

| ID | Scenario | Target outcome |
|----|----------|----------------|
| **K1** | Attacker copies encrypted identity JSON / backup bundle | Decryption infeasible without passphrase (strong KDF) |
| **K2** | Attacker copies native keychain / LevelDB | No plaintext nsec without OS unlock + further user action |
| **K3** | User pastes private key into Discovery / chat / import by mistake | **Reject or warn** before identity is created |
| **K4** | Attacker with offline backup runs Hashcat on weak passphrase | Work factor high enough for product claim; weak passwords flagged at create |
| **K5** | Malware scrapes clipboard after user copies nsec | Clipboard TTL + paste guards reduce window |
| **K6** | Remote attacker while app **locked** | No PDK / signing key in process (T7 alignment) |
| **K7** | Remote attacker while app **unlocked** | **Best-effort** — document T8 limit; zeroize on lock |

---

## 3. Current state (2026-07-10)

### 3.1 Landed

| Layer | Implementation | Owner |
|-------|----------------|-------|
| Identity encrypt-at-rest | PBKDF2-SHA256 **200k** + AES-256-GCM | `packages/dweb-crypto/encrypt-private-key-hex.ts` |
| PIN wrap (optional) | PBKDF2-SHA256 **150k** + AES-GCM | `pin-lock-service.ts` |
| PDK / vault envelope | PBKDF2-derived PDK + `obscur-storage-envelope-v1` | `profile-data-key.ts`, `vault-at-rest.ts` |
| Discovery secret guard | `nsec`/`ncryptsec` parse rejection; hex relay disambiguation | `parse-public-key-input.ts`, `identity-resolver.ts` |
| Native signing boundary | Desktop `wallet.rs` / session; `Zeroizing` in Rust | `apps/desktop/src-tauri/` |
| Memory hygiene (partial) | PDK zeroize on lock | `profile-storage-key-session.ts` |

### 3.2 Gaps

| ID | Gap | Risk |
|----|-----|------|
| G1 | **PBKDF2 not memory-hard** — GPU-friendly vs Argon2id charter target | K4 — offline passphrase crack |
| G2 | **Native keychain may store plaintext nsec** for session restore | K2 — OS boundary is only gate |
| G3 | **Secret-input firewall** only on Discovery path | K3 — chat/import/settings still accept secrets |
| G4 | **SQLite / profile archives** partially plaintext (charter T4–T6) | K1 — metadata + messages leak offline |
| G5 | **No unlock rate limit / lockout** policy | Online guessing on unlock UI |
| G6 | **No NIP-49-first export** policy | Users export raw hex |
| G7 | **Passphrase strength** not enforced at create/import | Weak passwords defeat strong KDF |

---

## 4. Architecture — canonical owners

```text
┌─────────────────────────────────────────────────────────────┐
│  UI surfaces (search, chat, import, settings, export)        │
│    └─ secret-input-firewall (reject nsec / private hex)      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Auth kernel / unlock                                        │
│    passphrase → KDF → PDK (memory only while unlocked)       │
│    rate limit · lockout · strength meter                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  @dweb/crypto — SINGLE encrypt/decrypt envelope owner          │
│    v1: PBKDF2-SHA256/AES-GCM (legacy read)                    │
│    v2: Argon2id/AES-GCM (new write)                            │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Persistence                                                   │
│    encrypted identity blob · SQLCipher · vault AEAD            │
│    native keychain: wrapped unlock token (not raw nsec)        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Native signing (desktop) — scalar never returned to WebView   │
└─────────────────────────────────────────────────────────────┘
```

**Subtraction rules**

- One KDF/envelope owner: `@dweb/crypto` — no ad-hoc PBKDF2 in feature folders.
- No parallel “encrypt identity” paths — migrate via versioned `alg` field.
- UI must not implement crypto — call ports / services only.

---

## 5. Phased delivery

### Phase 0 — Documentation + band registration (this spec)

- Register `KEY-MOAT-1` in handoff when implementation starts.
- Cross-link antisocial-engineering contract.

### Phase 1 — Secret-input firewall (K3)

**Scope:** Extend Discovery guards to all high-risk paste surfaces.

| Surface | Behavior |
|---------|----------|
| Discovery / Add Friend | **Done** — nsec reject; hex disambiguation |
| Chat compose | **Done** — block send when nsec/ncryptsec embedded |
| Contact request / invitation composer | **Done** — block intro/note with secrets |
| Import identity / restore | Intentional bypass — canonical import flow only |
| Profile / public fields | **Done** — block username/about with secrets |
| Settings export | **Done** — typed `EXPORT KEY` confirm + literacy copy on lock/import |

**Owner:** `secret-input-firewall.ts` consumed by `use-chat-actions.ts`, `settings-tab-panel-shared.tsx`, `parse-public-key-input.ts`, invitation composer

**Proof (L1):**

- `pnpm test:run app/features/security/services/secret-input-firewall.test.ts`
- `pnpm test:run app/features/profile/utils/parse-public-key-input.test.ts`

### Phase 2 — Argon2id KDF migration (K1, K4)

**Status:** Identity envelope + PDK v2 write + v1 read fallback **landed** (2026-07-10). Unlock re-wrap wired. Rust v2 vector parity in `libobscur`.

**Scope:** Versioned identity + PDK derivation.

| Field | Value |
|-------|-------|
| New `alg` | `"Argon2id/AES-256-GCM"` |
| Params (default) | `m=65536, t=3, p=4` (64 MiB, 3 passes, 4 lanes) — tune after soak |
| High-security profile flag | `m=131072, t=4, p=4` optional at create |
| Legacy read | PBKDF2 v1 blobs decrypt unchanged |
| Re-wrap on unlock | Optional background re-encrypt to v2 after successful unlock |

**Owners:** `packages/dweb-crypto` (derive + encrypt/decrypt), `profile-data-key.ts`, `encrypt-private-key-hex.ts`

**Dependencies:** `@noble/hashes` argon2 or vetted WASM with same test vectors.

**Proof (L1):** KDF test vectors · round-trip v1/v2 · migration test  
**Proof (L3):** create profile → lock → cold restart → unlock on desktop non-default data root

### Phase 3 — Keychain hardening (K2)

**Status:** **landed** (2026-07-10) — `OBSCUR_KCV1` AES-GCM envelope in OS keychain; legacy plaintext `nsec1` migrates on read.

**Scope:** Stop long-lived plaintext nsec in OS keychain where platform allows wrap.

| Today | Target |
|-------|--------|
| `native_keychain.rs` stores nsec string | Store **wrapped PDK** or platform-specific unlock blob |
| Session hydrates nsec into memory | Hydrate signing handle / session key only |
| Remember-me | OS-gated wrap + explicit user consent copy |

**Owners:** `native_keychain.rs`, `wallet.rs`, `session.rs`

**Proof (L4):** Windows Credential Manager / macOS Keychain Access — entry password field starts with `OBSCUR_KCV1:` (no `nsec1` grep match). Legacy entries migrate on next unlock.

### Phase 4 — Unlock policy (K4, K5)

**Status:** **landed** (2026-07-10) — passphrase policy owner, unlock backoff, clipboard clear (ASE-1a).

| Control | Detail |
|---------|--------|
| Passphrase strength | zxcvbn or equivalent; block top-N passwords; min length 12+ or 4-word passphrase |
| Rate limit | Exponential backoff; optional wipe after N failures (user opt-in) |
| Clipboard | Clear nsec/private hex from clipboard after 30s when copied from export flow |

**Owners:** auth kernel, `identity-passphrase-unlock.ts`, lock screen UI

### Phase 5 — At-rest charter alignment (K1, K6)

Completes v1.9.8 gaps **G4** in coordination with `VAULT-SANDBOX-1`:

- SQLite at-rest via Rust `.obscur-enc` sidecar (`obscur.sqlite3` while unlocked; encrypted on lock)
- Encrypted profile removal archives (native destructive flows require PDK session)
- Vault always ciphertext (`encryptVaultBytesForWrite`; deprecated helper no plaintext fallback)

**Status (2026-07-10):** **Implemented** — vault hardening (VAULT-SANDBOX Phase 1), layout migration (Phase 5), archive fail-closed on native removal, contract tests

**Proof**

| Layer | Command |
|-------|---------|
| L1 | `pnpm verify:storage-encryption-v1.9.8` |
| L2 | `node scripts/audit-data-root-at-rest.mjs <data-root>` while locked |
| L3 | [vault-sandbox-l3-verification-2026-07.md](./vault-sandbox-l3-verification-2026-07.md) §3–§5 (maintainer G8) |

### Phase 6 — Hardware step-up (optional, post-v2)

- Windows Hello / Touch ID gates keychain restore when **Biometric lock** is enabled
- FIDO2 ceremony for export / high-value sign — **deferred** (future band)

**Status (2026-07-10):** **Implemented (slice 6a)** — `platform_biometric.rs`, `get_biometric_capability`, gated `forceSessionRestore` + auth assistant unlock

**Proof**

| Layer | Command |
|-------|---------|
| L1 | `pnpm -C apps/pwa exec vitest run app/features/security/services/hardware-unlock-gate.test.ts app/features/security/services/key-moat-hardware-phase6.contract.test.ts` |
| L1 (Rust) | `cd apps/desktop/src-tauri && cargo test platform_biometric` |
| L3 | Settings → Security → enable Biometric lock → lock → unlock via Hello/Touch ID |

---

## 6. KDF decision record

| Option | For | Against | Verdict |
|--------|-----|---------|---------|
| SHA-256(passphrase) | — | Trivially brute-forced | **Reject** |
| PBKDF2-SHA256 200k | Already shipped; WebCrypto native | GPU-friendly | **Legacy read only** |
| scrypt | Memory-hard | Less standard in WebCrypto | Fallback if Argon2 WASM blocked |
| **Argon2id** | Charter target; Hashcat-resistant | Needs WASM/native impl | **New write default** |

**Rule:** SHA-256 appears only **inside** KDF/HMAC/AEAD — never as the sole password protection.

---

## 7. Proof plan (by phase)

| Phase | L1 (unit) | L3 (integration) | L4 (maintainer) |
|-------|-----------|--------------------|-----------------|
| 1 Firewall | secret-input-firewall tests | paste nsec in chat blocked | manual demo GIF add-contact path |
| 2 Argon2id | dweb-crypto KDF vectors | unlock cold desktop | portable drive soak |
| 3 Keychain | rust unit tests | remember-me cycle | keychain audit runbook |
| 4 Unlock policy | strength + rate limit tests | 10 failed unlocks backoff | — |
| 5 At-rest | storage encryption tests | T1/T2 charter rows | G8 maintainer sign-off |

---

## 8. Register / handoff

| Milestone | Exit criteria |
|-----------|---------------|
| Phase 1 | All paste surfaces use shared firewall; Discovery regression green |
| Phase 2 | New profiles write Argon2id; legacy PBKDF2 still unlocks |
| Phase 3 | No plaintext nsec in keychain on Windows/macOS audit |
| Band complete | K1–K4 mitigated with L3 evidence; K7 documented in known limitations |

**Does not claim:** phishing resistance (see antisocial-engineering contract) · T8 unlocked-session immunity

---

## 9. References

| Document | Role |
|----------|------|
| [discovery-friend-code-private-key-2026-07.md](./discovery-friend-code-private-key-2026-07.md) | Phase 1 Discovery slice |
| [vault-encryption-sandbox-plan-2026-07.md](./vault-encryption-sandbox-plan-2026-07.md) | Vault / PDK at-rest |
| [auth-keychain-restore-failed-r2-design-2026-07.md](./auth-keychain-restore-failed-r2-design-2026-07.md) | Unlock materialization patterns |
| [rules/05-auth-and-identity.md](../../rules/05-auth-and-identity.md) | Identity ownership rules |
