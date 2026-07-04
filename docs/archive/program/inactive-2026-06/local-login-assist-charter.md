# Local login assist — charter

**Status:** **Withdrawn** (2026-06-08) — v1.9.7 subtraction; wallet-style password unlock retained  
**Last updated:** 2026-06-08  
**Replaces (conceptually):** deferred Auth Assistant ([obscur-auth-assistant-charter.md](./obscur-auth-assistant-charter.md)) and silent cold-boot remember-me ([v1.9.6-session-persistence-redesign.md](./v1.9.6-session-persistence-redesign.md) § Feasibility decision)  
**Related:** [auth-ux-redesign-future.md](./auth-ux-redesign-future.md) · `rules/05-auth-and-identity.md` · `rules/11-feasibility-and-modular-safety.md`

---

## Problem

Desktop unlock requires re-entering username and master password after every cold start. Silent “stay signed in” / keychain session restore is **deferred** (boot-order races). Auth Assistant (parallel unlock IPC + title-bar panel) was **reverted** after save/list/unlock failed in manual testing.

Users need **Chrome-style saved login** — local username + password autofill on the auth screen — without storing private keys or skipping the auth surface.

---

## Design principle: assisted form fill, not session restore

```text
Remember me (deferred)     →  cold start already unlocked (failed)
Auth Assistant (deferred)  →  parallel native unlock IPC (failed)
Local login assist         →  auth screen → fill fields → existing handleLoginUsername path
```

**Do not:**

- Modify `AuthGateway` auto-restore effects
- Store private keys, `nsec`, or hex in the vault or export payload
- Write unlock material to browser `localStorage` on desktop
- Add silent autologin on boot

**Do:**

- One TS owner: `login-credential-vault-service.ts`
- Native desktop storage: OS keychain via Tauri (`login_assist_*` commands)
- Panel on `auth-screen.tsx` scoped to bound `profileId`
- Post-unlock prompt to save username + password only
- Optional export toggle in encrypted workspace bundle (credentials inside E2EE ciphertext only)

---

## Security model

| Stored | Not stored |
|--------|------------|
| Username | Private key / `nsec` / hex |
| Master password (unlock passphrase for local identity) | Session unlock tokens in `localStorage` |

**First bind on new device/window:** import private key (unchanged). Password login works only when a local identity record exists.

**Threat model (honest copy):** Same class as Chrome saved passwords — local malware or disk access can read OS keychain entries. This does **not** replace key backup. Pre-auth network sandbox is a separate future lane (not required for v1).

---

## User flows

### Returning user (same profile window)

1. Open Obscur → auth screen (expected).
2. **Saved login** panel shows stored username.
3. Tap **Fill & sign in** → fields populated → `handleLoginUsername` → chat.

### First successful password login

1. User logs in manually (or imports key once, then password).
2. Prompt: **Save username and password on this device?**
3. Accept → keychain write scoped to `profileId`.

### New device

1. Import private key (required).
2. Optional: import workspace bundle with **Include saved login credentials** → seeds vault after identity exists.

---

## Architecture

```text
┌─────────────────────────────────────────┐
│  auth-screen.tsx                         │
│  LocalLoginAssistPanel (read/fill/remove)│
│  LocalLoginAssistSavePrompt (after login)│
└──────────────────┬──────────────────────┘
                   │ login-credential-vault-service (ONE owner)
                   ▼
┌─────────────────────────────────────────┐
│  Tauri: login_assist_read/write/delete   │
│  OS keychain: login_assist::{profileId}  │
└─────────────────────────────────────────┘
                   │
                   ▼
         handleLoginUsername (unchanged unlock path)
```

---

## Export / import

Optional field on encrypted workspace bundle payload:

```typescript
loginCredentialAssist?: { username: string; password: string }
```

- Toggle **Include saved login credentials** — default **off**
- Field lives inside bundle ciphertext (encrypted with account keys at export)
- Import seeds vault for target `profileId`; never exports or stores private key in this block

---

## Phased delivery

| Phase | Scope | Gate |
|-------|--------|------|
| **LLA-0** | Charter + contracts | Doc review |
| **LLA-1** | Vault service + keychain + auth panel + save prompt | `pnpm verify:local-login-assist` |
| **LLA-2** | Export/import toggle | Same gate + bundle contract test |

---

## Programmatic gate — AUTH-LOGIN-VAULT-1

`pnpm verify:local-login-assist` must pass before ship claims:

1. Vault schema contract — no `privateKeyHex`, `nsec`, or `encryptedPrivateKey` in vault types/export assist field definitions
2. Service unit tests — save, read, delete, profile scope
3. Panel/save-prompt component tests (smoke)
4. Bundle payload includes assist only when opted in

Manual: login → save → reload auth → Fill & sign in → chat (maintainer smoke, not progress gate).

---

## Explicit non-goals

- Cold-boot skip login (AUTH-SESSION-1)
- Auth Assistant title-bar / tray UI
- Server-side credential storage
- OAuth / centralized IdP

---

## Code owners

| Concern | Owner |
|---------|--------|
| Vault read/write/delete | `login-credential-vault-service.ts` |
| Keychain persistence | `native_keychain.rs` + `commands/login_assist.rs` |
| UI panel + prompt | `local-login-assist-panel.tsx`, `local-login-assist-save-prompt.tsx` |
| Export toggle | `encrypted-workspace-bundle-*`, `encrypted-workspace-export-panel.tsx` |
| Unlock | `auth-screen.tsx` → `handleLoginUsername` (unchanged semantics) |
