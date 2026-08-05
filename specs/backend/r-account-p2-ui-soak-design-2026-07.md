# Design — R-ACCOUNT P2 unlock→shell UI soak (release exe)

**Status:** Soak executed · **Pass** (2026-07-31 re-soak after Tester1 align) · evidence [`docs/handoffs/r-account-p2-ui-soak-2026-07-31.md`](../../docs/handoffs/r-account-p2-ui-soak-2026-07-31.md)  
**Date:** 2026-07-30 (UTC) · re-soak 2026-07-31  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md) · [r-account-slice5-design-2026-07.md](./r-account-slice5-design-2026-07.md)  
**Prior evidence:** L3a [r-account-l3a-parity](../../docs/handoffs/r-account-l3a-parity-2026-07-30.md) · L3b keychain [r-account-l3b-keyring-fix](../../docs/handoffs/r-account-l3b-keyring-fix-2026-07-30.md) · early L3b fail [r-account-l3b-release](../../docs/handoffs/r-account-l3b-release-2026-07-30.md) · Fail then align [r-account-align-tester1-2026-07-31.md](../../docs/handoffs/r-account-align-tester1-2026-07-31.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     P2 unlock→shell UI soak on release exe (or community un-pause charter)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite · Dev Lab · group db_*
CANONICAL OWNER:      auth-kernel unlock → init_native_session + auth_boot_snapshot → shell
PROOF BEFORE DONE:    Matrix below on release exe + CDP · digest + session invoke
OUT OF SCOPE:         Product code unless soak fails with named owner · group/invite · AUTH-SESSION-1
```

---

## Goal

Close Slice 5 / P2 **package verified** only when release-exe unlock reaches main shell with matching scope and live session — not keychain L3b alone.

| May claim after this soak | |
|---------------------------|--|
| P2 package verified | Only if all Pass rows below |
| Keychain persist | Already Pass (L3b) — do not re-litigate unless soak shows `keychainPresent: false` |
| Product code | None if Pass; one-owner design amend if Fail |

---

## Surface

| Item | Value |
|------|--------|
| Exe | `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe` |
| CDP | `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230` |
| Fixture | [obscur-dev-test-accounts.md](../../docs/program/obscur-dev-test-accounts.md) — Tester1 |
| Unlock UI | Password field → `form button[type=submit]` (avoid duplicate Log In roles) |

---

## Pass matrix (release)

| # | Check | Pass |
|---|--------|------|
| 1 | After unlock | Main shell (Chats / nav) — not Welcome Back / DemoUser forever |
| 2 | Identity | Surface shows Tester1 (or bound profile), not DemoUser gate |
| 3 | Session | CDP invoke `get_session_status` → `is_active: true` |
| 4 | Boot | `auth_boot_snapshot` → `phase: unlocked` · `keychainPresent: true` · `profileId` matches bind |
| 5 | Digest | Prefer `auth.kernel_boot_restore_succeeded` or unlocked phase — not `kernel_boot_restore_exhausted` / stuck `no_keychain` after unlock |
| 6 | Optional F5 | Reload stays unlocked **or** honest Welcome Back with restore digest classified — F5 fail does **not** fail P2 unlock→shell if steps 1–5 Pass (AUTH-KERN-1 is separate band) |

---

## Procedure

1. Kill stale Obscur if wrong build; launch release exe with CDP `:9230`.
2. Attach Studio / CDP session to `http://tauri.localhost/`.
3. Snapshot UI gate (Welcome Back vs shell).
4. Unlock Tester1 (`SyI14^ew1E`) via password + form submit.
5. Assert shell + invoke session/boot + pull digest.
6. Write evidence under `docs/handoffs/r-account-p2-ui-soak-2026-07-30.md`.
7. Checkpoint handoff: Pass → close P2; Fail → name owner, no scatter patch.

---

## Branch on outcome

| Outcome | Next |
|---------|------|
| Pass | Close P2 package verified · next = community un-pause charter **or** hold |
| Fail DemoUser / no keychain | Re-open keychain owner (already fixed once — capture regress evidence) |
| Fail unlock UI / shell | Name owner (auth-kernel vs shell bake vs scope) — design amend before code |
| Fail F5 only | Do **not** claim AUTH-KERN-1 fixed; P2 unlock may still Pass |

---

## Forbidden

- Claiming P2 fixed from L3b keychain alone
- AUTH-SESSION-1 silent unlock
- Patching Welcome Back copy instead of owners
- Touching community / group `db_*`
