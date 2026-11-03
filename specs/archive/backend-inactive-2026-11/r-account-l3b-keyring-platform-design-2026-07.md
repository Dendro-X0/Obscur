# Design — R-ACCOUNT L3b keyring platform backend

**Status:** Implemented · L3b Pass · 2026-07-30 · evidence [`docs/handoffs/r-account-l3b-keyring-fix-2026-07-30.md`](../../docs/handoffs/r-account-l3b-keyring-fix-2026-07-30.md)  
**Investigation:** [r-account-l3b-keychain-investigation-2026-07.md](./r-account-l3b-keychain-investigation-2026-07.md)  
**L3b live:** release `init_native_session` → same-process `keychainPresent: true` · cold restart → `false` · `cmdkey` has **no** `app.obscur`

---

## Session gate

```text
NEXT ATOMIC STEP:     R-ACCOUNT L3b — fix keyring platform persist
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      apps/desktop/src-tauri Cargo keyring features + native_keychain write fail-loud
PROOF BEFORE DONE:    cargo build release · L3b write → cold restart → keychainPresent true
OUT OF SCOPE:         Second APP_SERVICE · AUTH-SESSION-1 · community
```

---

## Root cause

`Cargo.lock` shows `keyring` 3.6.3 depends only on `log` + `zeroize` — **no** `windows-native` / Wincred. With empty default features, `Entry::set_password` does not persist to Windows Credential Manager.

`write_nsec_for_profile` then hits read-back `NoEntry`, still returns `Ok` and fills `SESSION_SECRET_CACHE` → same-process `keychainPresent: true` is a **cache lie**.

---

## Change

| Slice | Action |
|-------|--------|
| 1 | `keyring = { version = "3", default-features = false, features = ["windows-native", "apple-native", "linux-native", "sync-secret-service"] }` — or cfg-split features per target |
| 2 | Fail-loud: `write_nsec_for_profile` must **not** `Ok` on persistent read-back miss (retry once; then `Err`) |
| 3 | `auth_boot_snapshot` `keychainPresent` uses store read that **skips** process cache (or clear cache before presence check) |

Prefer target-specific features in Cargo.toml:

```toml
[target.'cfg(windows)'.dependencies]
keyring = { version = "3", features = ["windows-native"] }

[target.'cfg(target_os = "macos")'.dependencies]
keyring = { version = "3", features = ["apple-native"] }

[target.'cfg(target_os = "linux")'.dependencies]
keyring = { version = "3", features = ["linux-native-sync-persistent"] }
```

Remove bare `keyring = "3"` from common deps.

---

## Mental simulation

1. Release unlock/import → `set_password` writes Wincred.  
2. Cold start → `read_nsec_for_profile` finds entry → `keychainPresent: true`.  
3. `cmdkey` / Wincred lists service `app.obscur.desktop`.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | `cargo check -p obscur_desktop_lib` (or desktop package) |
| L3 | release exe: `init_native_session` → kill → relaunch → `auth_boot_snapshot.keychainPresent === true` |

---

## Claim language

| May say | When |
|---------|------|
| Implemented | Features + fail-loud landed |
| Fixed (L3b) | Cold restart keychainPresent true on release |
