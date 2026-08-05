# R-ACCOUNT L3b evidence — release-exe keychain persist (2026-07-30)

**Surface:** `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe`  
**CDP:** `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230`  
**Design:** [r-account-l3b-keyring-platform-design-2026-07.md](../../specs/backend/r-account-l3b-keyring-platform-design-2026-07.md)  
**Prior fail:** [r-account-l3b-release-2026-07-30.md](./r-account-l3b-release-2026-07-30.md) (`keychainPresent: false` · no Wincred)

## Root cause (fixed)

`keyring = "3"` with **empty default features** — no Windows Credential Manager backend.  
`write_nsec_for_profile` returned `Ok` on read-back `NoEntry` and filled process cache → same-process lie; cold boot empty.

## Keep-set

| Change | File |
|--------|------|
| `windows-native` / `apple-native` / `linux-native-sync-persistent` per target | `apps/desktop/src-tauri/Cargo.toml` |
| Fail-loud write (retry once; no cache-only `Ok`) | `native_keychain.rs` |
| Boot `keychainPresent` via `os_keychain_has_nsec_for_profile` (skip cache) | `auth_boot.rs` + `native_keychain.rs` |

## Build

`cargo build --release -p obscur_desktop_lib` · OK · keyring pulled `windows-sys`

## L3b probe (release)

| Step | Result |
|------|--------|
| Baseline cold | `keychainPresent: false` · session inactive |
| `init_native_session` Tester1 hex | `success: true` · npub `npub1uplk0h9c5k848vfl69dw2jwrr7ecz736dncw30tfqwaw8sv3aftq3rtdrg` |
| Same-process boot | `keychainPresent: true` |
| Wincred | `LegacyGeneric:target=nsec::default.app.obscur.desktop` **present** |
| Kill + relaunch | **`keychainPresent: true`** · session re-hydrated (`is_active: true`, Tester1 pubkey hex) |

## Verdict

| Gate | Result |
|------|--------|
| L3b OS persist | **Pass** |
| Cache-lie fixed | **Pass** (OS presence + Wincred) |
| P2 full create/unlock UI matrix | Not claimed here — keychain owner repaired; package bootstrap UI soak separate if still DemoUser gate |

## Claim language

| May say | |
|---------|---|
| Implemented | Yes |
| Verified (L3b keychain) | Yes — cold restart + Wincred |
| Fixed (runtime) | Yes — release exe OS keychain persist |
| P2 package verified | **No** until full unlock→shell product matrix if still required |
