# Investigation — Save to Vault unlock prompt + missing i18n

**Date (UTC):** 2026-08-04  
**Status:** Pass (L1) · maintainer desktop verify pending  
**Evidence:** Maintainer screenshots (toast + lightbox dialog) · ver. 1.9.14

---

```text
NEXT ATOMIC STEP:     (user pivot) Vault save unlock UX + i18n
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      les-chat-save / VaultWriteUnlockDialog / i18n en.json
PROOF BEFORE DONE:    L1 locale key presence + les ensure ready / presentation tests
OUT OF SCOPE:         AUTH-SESSION revive · Soft L3 · groups/**
```

## Symptoms

1. **Toast:** “Unlock this profile to save encrypted vault files.” while chat UI is already unlocked.  
2. **Lightbox dialog:** Raw keys (`vault.writeUnlockTitle`, CSS-uppercased eyebrow `VAULT.WRITEUNLOCKEYEBROW`, …).

## Root causes

### A — i18n (confirmed)

- Runtime loads `apps/pwa/app/lib/i18n/locales/en.json` only (`config.ts`).  
- `vault.writeUnlock*` strings exist in `chunks/en/en.chunk-1-of-2.json` but were **never merged into `en.json`**.  
- Eyebrow uses `uppercase` CSS → missing key `vault.writeUnlockEyebrow` renders as `VAULT.WRITEUNLOCKEYEBROW`.

### B — Identity unlock ≠ vault PDK (by design + gaps)

- Chat Save → LES requires in-memory + native **profile data key** (`isVaultEncryptionSessionReady` / Rust `StorageAtRestState`).  
- Stay-signed-in / OS session restore unlocks **identity** via `syncVaultEncryptionSessionBestEffort` **without passphrase**; vault key only returns if keychain PDK restore succeeds.  
- If PDK was never written to keychain, `unlock_required` is correct — dialog must be readable (A).  
- Context menu / message-list call `saveChatAttachmentToLocalVault` → toast only; lightbox opens `VaultWriteUnlockDialog` (asymmetric UX).  
- Gap: when JS PDK session is ready but native LES state lacks the key (or profile-id default diverges), commit fails with “Unlock this profile…” and surfaces as another unlock prompt.

## Fix plan

1. Add `vault.writeUnlock*` to `en.json` (+ zh/es/fr/de mirrors).  
2. Align storage-key session defaults with `resolveVaultProfileId`.  
3. On LES save ensure-ready: if JS PDK present, push to native `desktop_storage_at_rest_unlock`.  
4. Context menu (and message-list if cheap): use outcome + `VaultWriteUnlockDialog` like lightbox.

## Proof

| Layer | Check |
|-------|--------|
| L1 | Keys present in `en.json`; vitest for ensure-ready / peer paths as touched |
| L3 | Maintainer: Save to Vault from lightbox shows English dialog; after passphrase, save succeeds without key-soup |
