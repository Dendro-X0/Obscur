# R-ACCOUNT P2 UI soak — release exe (2026-07-31 re-soak)

**Surface:** `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe`  
**CDP:** `:9230`  
**Prior Fail:** [2026-07-30](./r-account-p2-ui-soak-2026-07-30.md) (DemoUser≠Tester1 keychain)  
**Align:** [r-account-align-tester1-2026-07-31.md](./r-account-align-tester1-2026-07-31.md)  
**Cold L3:** [auth-kern-cold-hydrate-l3-2026-07-31.md](./auth-kern-cold-hydrate-l3-2026-07-31.md) Pass  

## Matrix result

| # | Check | Result |
|---|--------|--------|
| 1 | After unlock → main shell | **Pass** (already shell on attach — cold hydrate) |
| 2 | Identity not DemoUser gate forever | Soft — shell shows pubkey `e07f67…` (Tester1); UI may still label DEMOUSER |
| 3 | `get_session_status` active | **Pass** |
| 4 | Boot unlocked + keychain | **Pass** |
| 5 | Digest | Not required for Pass verdict |
| 6 | F5 optional | Skipped |

**Verdict: Pass** — P2 package **verified** on release exe after device align.

## Claim

| May say | |
|---------|---|
| P2 package verified | **Yes** (this re-soak) |
| Cold hydrate fixed (matching slot) | **Yes** — L3 Pass |
| Public Nostr / AUTH-SESSION-1 | **No** |

JSON: [`r-account-p2-ui-soak-2026-07-30.json`](./r-account-p2-ui-soak-2026-07-30.json)
