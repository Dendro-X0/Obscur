# Solution record — Authentication face (beyond raw keypairs)

**ID:** F-auth-schemes-solution  
**Status:** **direction recorded** (exploration band — not implemented · not F9 GO)  
**Date (UTC):** 2026-11-09  
**Parent analysis:** [`15-auth-schemes-beyond-raw-keypairs.md`](./15-auth-schemes-beyond-raw-keypairs.md)  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`

## Decision (product face)

| Layer | Chosen direction |
|-------|------------------|
| **Daily unlock (Plane 1)** | **Password-wrapped** local root key + PDK; optional **passkey / OS keystore / hardware** as unlock of the **same** workspace |
| **Recovery (Plane 2)** | Encrypted recovery file + password; raw keypair / seed = **Advanced only** |
| **Continuity (Plane 3)** | Separate from unlock; OPAQUE/server envelopes only if later chartered |
| **Wire / carrier identity** | Hub **linked identities** (keys/tokens behind adapters) — users do not paste hex daily |
| **Rejected as root** | OAuth / email / SMS / custodial IdP |

## Why this is “better” than raw keypairs

- **UX:** humans use a password (or platform unlock), not `nsec`.  
- **Security:** phishing surface shrinks; secrets stay in kernel/keystore.  
- **Feasibility:** extends single-door + PDK already in tree; no DID/OPAQUE required for Cut 0.

## Non-claims

- Not Pass · not Continuity shipped · not “passwordless product” · not biometric-required MFA.

## Next

Auth/Profile Cut 0 designs (when F9 opens) must honor this face. Exploration continues on other planes (relationship discovery next).
