# R-ACCOUNT P2 UI soak — release exe (2026-07-30)

**Surface:** `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe`  
**CDP:** `:9230` (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`)  
**Design:** [r-account-p2-ui-soak-design-2026-07.md](../../specs/backend/r-account-p2-ui-soak-design-2026-07.md)  
**Script:** `scripts/r-account-p2-ui-soak-cdp.mjs`  
**Raw:** [r-account-p2-ui-soak-2026-07-30.json](./r-account-p2-ui-soak-2026-07-30.json) · gate shot [r-account-p2-ui-soak-gate.png](./r-account-p2-ui-soak-gate.png)

## Session gate (quoted)

```text
NEXT ATOMIC STEP:     Maintainer: P2 unlock→shell UI soak on release exe · or community un-pause charter
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite · Dev Lab · group db_*
CANONICAL OWNER:      auth-kernel unlock → init_native_session + auth_boot_snapshot → shell
PROOF BEFORE DONE:    P2 matrix on release exe
OUT OF SCOPE:         Product code without named-owner design amend · group/invite
```

## Matrix result

| # | Check | Result |
|---|--------|--------|
| 1 | After unlock → main shell | **Fail** — stays Welcome Back |
| 2 | Identity Tester1 (not DemoUser forever) | **Fail** — gate = **DemoUser** |
| 3 | `get_session_status` active | **Pass (native)** — `is_active: true` · pubkey `e07f67…ea56` (not Tester1 fixture) |
| 4 | `auth_boot_snapshot` unlocked + keychain | **Pass (native)** — `phase: unlocked` · `keychainPresent: true` · `profileId: default` (with `restoreEligible: true`) |
| 5 | Digest unlock success | Not asserted — UI never left gate |
| 6 | F5 optional | Skipped |

**Verdict: Fail** — P2 package **not** verified.

## Observations

1. Cold relaunch → **Welcome Back · unlock DemoUser**.
2. UI unlock with Tester1 password (`SyI14^ew1E`) → **Incorrect password** (expected if device password is DemoUser’s, not Tester1).
3. Wincred still has `LegacyGeneric:target=nsec::default.app.obscur.desktop` (L3b keychain persist still present).
4. Native session already active while UI shows lock gate — **UI/boot hydrate does not consume unlocked native session**.
5. Playwright sees `__TAURI_INTERNALS__.invoke` (not `__TAURI__.core.invoke`) on this release shell.
6. Import Key click from automation did not reliably open nsec entry (separate UX probe; not required to close Fail verdict).

## Claim language

| May say | |
|---------|---|
| Implemented (soak harness) | Yes — design + CDP script |
| Verified (P2 package) | **No** |
| Fixed (unlock→shell UI) | **No** |
| L3b keychain persist | Still Pass (Wincred + `keychainPresent`) — unchanged |

## Named owner (for next charter — no code this step)

| Symptom | Likely owner | Must not |
|---------|--------------|----------|
| Welcome Back while native `is_active` + boot `phase: unlocked` | `auth-kernel-boot-owner` / AUTH-KERN hydrate path | AUTH-SESSION-1 silent unlock · UI copy patch |
| DemoUser gate vs Tester1 fixture | Profile slot / device-password bind for `default` | Clearing leases to force unlock |

## Next (maintainer)

1. Charter **AUTH-KERN hydrate** repair (Welcome Back vs active native) — design amend before code.  
2. Or community un-pause charter (independent fork).  
3. Hold — do not claim P2 fixed.

**Forbidden without charter:** AUTH-SESSION-1 · community/group `db_*` · agent-declared P2 UI fixed.
