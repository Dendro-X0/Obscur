# Investigation — Auth wallet unlock (hex cliffs on happy path)

**Date (UTC):** 2026-11-01  
**Status:** Complete · feeds design  
**Parents:** [auth-ux-redesign-future.md](../../docs/archive/program/inactive-2026-06/auth-ux-redesign-future.md) · [obscur-auth-kernel-charter-2026-06.md](../../docs/program/obscur-auth-kernel-charter-2026-06.md) · plan `auth_wallet_ux`

```text
HANDOFF ATOMIC STEP: AUTH WALLET UNLOCK — design-first band
PAUSED / CANCELLED: Soft L3 · Tor Verified · Spaces · Matrix promote · OAuth roots · multi-protocol adapter auth
CANONICAL OWNER:     auth-kernel + AuthScreen (Plane C device unlock)
PROOF BEFORE DONE:   investigation only (no product claim)
SURFACE:             Tauri desktop primary · browser auth screen secondary
```

## Symptom

Maintainer (and future non-technical users) treat **64-char hex / `nsec` paste** as the day-to-day unlock path, storing secrets in Notepad or an external password manager. Product claims “easy” while the welcome/login surface still peers **Import Key** with passphrase unlock.

## Owners (call chain)

| Concern | Owner |
|---------|--------|
| Auth UI modes / tabs | `apps/pwa/app/features/auth/components/auth-screen.tsx` |
| Passphrase decrypt candidates | `apps/pwa/app/features/profiles/services/identity-passphrase-unlock.ts` |
| Bound create / import / unlock | `apps/pwa/app/features/auth-kernel/auth-kernel-bound-profile-auth.ts` + surface hooks |
| Identity encrypt envelope | `packages/dweb-crypto/src/encrypt-private-key-hex.ts` (Argon2id v2) |
| Decode hex/nsec | `apps/pwa/app/features/auth/utils/decode-private-key.ts` |
| Device unlock port | `packages/dweb-auth/src/ports/device-unlock-port.ts` |
| Cold keychain restore | Rust `keychain_session_envelope.rs` · **deferred** (v1.9.6 feasibility) — out of this band |

## Path map

### Create (happy)

1. Welcome → Create Identity → username (step 1) → master password + confirm + responsibility checkbox (step 2).
2. `authKernel.createIdentityForBoundProfile` / PoW variant → encrypted `IdentityRecord` written → session unlock.
3. **Gap:** responsibility checkbox is copy-only; **no mandatory recovery-file download** before shell. Key material never shown (good) but also never forced into an offline recovery artifact (bad for wallet parity).

### Returning unlock — passphrase available

1. `hasPasswordProtectedUnlockOnDevice({ profileId, publicKeyHex })` probes local/harvested encrypted rows.
2. When probe returns **true**, effect does **not** force `loginTab = "username"` — only forces Import Key when **false**.
3. Initial entry route (`hasAppliedInitialEntryRouteRef`): **browser/mobile always opens Import Key** when any stored evidence exists (`setLoginTab(hasNativeRuntime() ? "username" : "key")`).
4. **Cliff:** browser returning users with a device password still land on `nsec1...` first.

### Returning unlock — no passphrase on device

1. Probe false → `loginTab = "key"` (correct portable path).
2. Import Key may then offer “set device password” guide (`importKeyGuideStep`).

### Import / Advanced

- Peer tab UI: Log In | Import Key (`loginTab` `"username" | "key"`).
- Welcome greenfield secondary CTA is literally `auth.welcome.loginWithKey` → opens Import Key.

### Lock / sign-out

- Lock clears in-memory session; keychain may preserve material (native).
- Sign-out deletes keychain material. Passphrase row should remain for password unlock when encrypted record exists.

## Hex / nsec still required on happy path?

| Scenario | Hex required today? |
|----------|---------------------|
| Create new identity | No (passphrase wraps generated key) |
| Return on **native** with password row | No if user picks Log In — but Import Key still peer-visible |
| Return on **browser** with password row | **Yes by default** — initial tab = Import Key |
| New device / no local password wrapper | Yes (import or restore backup) — correct |
| Passwordless native-only identity | Yes until device password set |

## Root cause (product, not crypto)

Crypto and Auth Kernel already implement the **two-secret model**. The cliff is **AuthScreen routing + create recovery gate**, not missing Argon2 wrapping.

## Non-goals (confirm)

- OAuth / email / phone IdP roots  
- Silent Instagram-style cold boot (keychain restore still deferred)  
- Multi-protocol adapter authentication facade  

## Next

Design: `specs/backend/auth-wallet-unlock-design-2026-11.md`

_Last updated: 2026-11-01T09:30:00Z_
