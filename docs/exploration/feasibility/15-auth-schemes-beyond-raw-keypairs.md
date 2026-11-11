# Feasibility — Auth schemes beyond raw public/private keypairs

**ID:** F-auth-schemes  
**Status:** draft (theoretical comparison) · **direction recorded in** [`15b-auth-schemes-solution-record.md`](./15b-auth-schemes-solution-record.md)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** `14-auth-profile-improvement-exploration.md` · `auth-continuity-audience-deliberation-2026-11.md` · F-PSE · F-hub · F-alt  
**Claim language:** **compared** ≠ implemented · ≠ Continuity Pass · ≠ OAuth-as-root

## 1. Scope

- **In:** Alternatives (and complements) to asking users to handle **raw keypairs / `nsec` / hex** — scored on **feasibility**, **UX**, and **security** for Obscur’s hub/workspace model.
- **Out:** Implementing a new scheme this phase; making biometrics a product requirement; replacing self-custody with IdP login.

## 2. Basics — the important split

“Better than keypairs” usually means **better than making humans manage key material**, not “cryptography without keys.”

| Layer | Question | Typical answer |
|-------|----------|----------------|
| **Identity root** | What proves “this is account X” on the wire? | Almost always a **public key** (or key-backed credential) |
| **Daily unlock** | What does the human do on *this* device each day? | Password, passkey, OS unlock, etc. |
| **Recovery** | How do they regain the root after wipe / new device? | File, threshold shares, guardians, hardware, … |

Obscur’s existing law already aims at this split (Planes 1–2–3): **device password daily**; **advanced key = recovery**; Continuity separate. The open question is whether other schemes beat that stack on the three axes.

**Binding constraints (unchanged):**

- No OAuth / email / SMS as **root** identity  
- No biometric MFA as **required** product gate  
- Self-custody / private-trust faces stay primary  

## 3. Capabilities map — scheme catalog

| ID | Scheme | What the user sees | What actually secures |
|----|--------|--------------------|------------------------|
| **K** | Raw keypair / seed | Paste `nsec`, 12–24 words | Long-term sk |
| **P** | Password-wrapped key (Obscur direction) | Device password | KDF → unwrap sk + PDK locally |
| **O** | OPAQUE / aPAKE envelope | Password (client–server ceremony) | Password unlocks client key envelope; server never sees password ([RFC 9807](https://www.rfc-editor.org/rfc/rfc9807)) |
| **W** | Passkeys / WebAuthn | Touch / PIN / platform prompt | Device-bound (or synced) auth key; RP stores pubkey ([MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Authentication/Passkeys), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html)) |
| **H** | Hardware key / OS keystore | Touch YubiKey / Secure Enclave | sk non-exportable in HSM-class store |
| **S** | Social / threshold recovery | Ask N of M guardians | Shamir / MPC / multisig over root |
| **D** | DID + verifiable credentials | “Present credential” | Still key-backed; ledger/issuer complexity |
| **N** | No global identity (SimpleX-like) | Per-contact invite links | Pairwise keys; no single account pubkey |
| **C** | Custodial / IdP account | Email magic link / Google | Provider is root — **rejected for Obscur root** |

### Scorecard (1–5; design judgment for Obscur)

| Scheme | Feasibility | UX | Security | Role fit |
|--------|-------------|----|----------|----------|
| K Raw keys | 5 (done) | 1 | 3* | Recovery / Advanced only |
| **P Password-wrap** | **5** | **4** | **4** | **Daily unlock + local PDK (keep)** |
| O OPAQUE | 3 | 4 | 4–5† | Useful if/when **server-held envelope** exists (continuity helper — not private-trust default) |
| W Passkeys | 3 | 5 | 4‡ | Strong **device unlock / second factor**; weak as **sole** decentralized root |
| H Hardware / keystore | 4 | 3–4 | 5 | Ideal **sk custody** under P/W |
| S Social recovery | 2 | 2–3 | 3 | Optional Plane 2/3 — guardian collusion / availability |
| D DID/VC | 1–2 | 2 | 3–4 | Research / enterprise attestation later |
| N Pairwise-only | 2 | 3 | 4 | Conflicts with “one workspace account” hub unless hybrid |
| C Custodial IdP | 5 | 5 | 1 as root | **Reject as root**; optional attestation bridge only |

\*Security of raw keys is high cryptographically, low in human practice (phish, paste, screenshots).  
†OPAQUE shines against server password theft; needs a registration server — clashes with offline-only private mesh unless Obscur runs a **blind** recovery service.  
‡Passkeys: excellent phishing resistance for *that RP*; sync/recovery often reintroduces Apple/Google custody; not a Nostr/Matrix wire identity by itself.

## 4. Fit to planes

| Plane | Better-than-raw-key recommendation |
|-------|-----------------------------------|
| **1 Daily unlock** | Keep **P**; optionally add **W** or **H** as unlock *capability* that unwraps the same local vault (not a second account). Biometrics only as OS-local UV inside passkey/keystore — never mandated. |
| **2 Recovery** | Primary: encrypted recovery file + password (as designed). Secondary candidates: **H** backup key; later **S** (threshold) for power users. Raw **K** stays Advanced. |
| **3 Continuity** | Not an auth scheme — backup/reconstitution. **O** only if a zero-knowledge recovery *service* is chartered; do not pretend password login reconstitutes chat. |
| **Wire identity** | Carriers still need **keys or tokens** (Nostr pubkey, Matrix device keys). Hub **linked identities** hide them; users should not paste them daily. |

## 5. Libraries / stacks (study only)

| Scheme | Candidates | Notes |
|--------|------------|-------|
| P | Argon2id / existing PDK path | Already in product direction |
| O | RFC 9807 implementations | Only with explicit recovery-server threat model |
| W | WebAuthn in Tauri/webview; platform authenticators | Map assertion → unlock local DEK, not “login to Google” |
| H | OS keychain / TPM / Secure Enclave (as-built native session lean) | Aligns with remember-me / PDK restore |
| S | Shamir / open threshold libs | High UX and ops cost |

## 6. Feasibility verdict

**There is no practical scheme that removes cryptographic keys from a self-custody messenger.** There **are** better schemes for what humans *do*.

| Verdict | Meaning |
|---------|---------|
| **Keep / strengthen P+H** | Best near-term balance: password (or passkey/keystore) unlocks local-wrapped root + PDK; raw keypair never daily UX |
| **W as optional Plane-1 enhancer** | `fit-with-adapter` — phishing-resistant unlock of the **same** workspace |
| **O** | `lab-only` until Continuity server design exists |
| **S / D** | `lab-only` / later power-user |
| **C as root** | `reject-for-core` |
| **N as sole model** | `reject-for-core` for hub “one workspace” (pairwise invites can still exist *inside* apps) |

### Recommended mental model (better than “users have keypairs”)

```text
Human face          Cryptographic reality
─────────────       ─────────────────────
Device password ─┐
Passkey / OS UV ─┼─► unwrap locally held root key + PDK
Hardware prompt ─┘         │
                           ▼
                   Workspace session capability
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Vault/DB    Linked Nostr   Linked Matrix …
                     identity        identity
```

**UX win:** users never see hex unless Advanced.  
**Security win:** phishing surface shrinks; secrets stay in kernel/keystore.  
**Feasibility win:** evolves current single-door design; does not require DID/OPAQUE/social recovery to ship Cut 0.

## 7. Risks / traps

- Marketing “passwordless” while the recovery path is still a seed (users feel betrayed).  
- Passkey sync via Big Tech silently becoming **custodial root**.  
- OPAQUE server that can MITM registration → false “zero knowledge.”  
- Social recovery without timelocks → guardian coercion.  
- Teaching users two accounts (passkey account ≠ Obscur workspace).  
- Replacing local password wrap with cloud IdP “for UX.”

## 8. Open questions

1. Should Cut 0 add **WebAuthn unlock of local DEK** beside password, or stay password-only until Rust auth crate?  
2. Is a **blind OPAQUE recovery helper** ever in scope for Continuity, or file/USB only?  
3. Threshold social recovery for private groups (guardians = other Obscur profiles) — interesting or out of face?  
4. Hardware-bound non-exportable identity keys vs exportable keys for carrier portability — which default?

## 9. References

- RFC 9807 OPAQUE — https://www.rfc-editor.org/rfc/rfc9807  
- Cloudflare OPAQUE explainer — https://blog.cloudflare.com/opaque-oblivious-passwords/  
- MDN Passkeys — https://developer.mozilla.org/en-US/docs/Web/Security/Authentication/Passkeys  
- OWASP Passkey Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html  
- Web3 recovery mechanisms survey (ePrint 2025/1687) — https://eprint.iacr.org/2025/1687.pdf  
- `specs/backend/auth-continuity-audience-deliberation-2026-11.md`  
- `docs/exploration/feasibility/14-auth-profile-improvement-exploration.md`
