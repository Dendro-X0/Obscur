# R-ACCOUNT L3b evidence — release-exe P2 (2026-07-30)

**Surface:** `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe`  
**CDP:** `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230` (release has no `debug_assertions` CDP)  
**Design:** [r-account-slice5-design-2026-07.md](../../specs/backend/r-account-slice5-design-2026-07.md)  
**L3a:** [r-account-l3a-parity-2026-07-30.md](./r-account-l3a-parity-2026-07-30.md) · **Pass**

## Build

- `pnpm desktop:build:exe` → OK · shell stamp `shell-2026-07-30T06:55:45Z` · `experimentOnline=true`
- Artifact: `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe`

## Observed (fail)

| Check | Release L3b | Parity L3a |
|-------|-------------|------------|
| UI gate | Welcome Back **DemoUser** | Unlock **Tester1** → shell |
| `get_session_status` | `is_active: false` | `is_active: true` |
| `auth_boot_snapshot` | `phase: locked` · **`keychainPresent: false`** | `phase: unlocked` · `keychainPresent: true` |
| Digest | `auth.kernel_boot_restore_no_keychain` | unlock → shell |
| Data root | `AppData\Roaming\app.obscur.desktop` · authority `appdata` | (same machine path expected) |
| Profile slot | `default` / Default | `default` |

Import-key attempt with Tester1 `nsec` did **not** reach main shell (UI stayed Welcome Back / DemoUser).

## Verdict

| Gate | Result |
|------|--------|
| L3a parity | Pass |
| L3b release | **Fail** — locked · no keychain · DemoUser gate |
| P2 verified | **No** |
| Code | None yet — amend design with owner |

## Likely owner (design priority #2)

**Keychain / native session identity differs between debug parity and release exe** (or DemoUser never wrote keychain). Same AppData path does not imply same OS secure-storage entries.

Not claiming data-root mis-bind (effective path looks healthy).

## Next

1. Amend R-ACCOUNT design: investigation of `native_keychain` service/account name under debug vs release.  
2. Smallest keep-set repair only after call-graph evidence.  
3. Re-run L3b unlock after repair.
