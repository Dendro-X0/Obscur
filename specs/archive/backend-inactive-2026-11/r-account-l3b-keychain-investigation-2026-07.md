# Investigation amend — R-ACCOUNT L3b keychain (debug vs release)

**Status:** Investigation (no product code) · 2026-07-30  
**Parent:** [r-account-slice5-design-2026-07.md](./r-account-slice5-design-2026-07.md)  
**Evidence:** [r-account-l3b-release-2026-07-30.md](../../docs/handoffs/r-account-l3b-release-2026-07-30.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     R-ACCOUNT L3b — keychain debug vs release investigation
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      native_keychain + init_native_session + auth_boot_snapshot
PROOF BEFORE DONE:    This amend · then design keep-set · then code · L3b re-soak
OUT OF SCOPE:         Community · second unlock path · UI-kit
```

---

## Call-graph (owners)

| Step | Owner |
|------|--------|
| Write on unlock/import | `init_native_session` → `native_keychain::write_nsec_for_profile` |
| Read on boot | `auth_boot_snapshot` → `read_nsec_for_profile` → `keychainPresent` |
| Service name | `APP_SERVICE = "app.obscur.desktop"` (single — **not** debug/release split) |
| Account / key | `nsec::{profile_id}` (+ legacy `nsec:: {profile_id}` migration) |

---

## Finding vs L3b hypothesis

Prior L3b note guessed “keychain service/account differs debug vs release.”

**Call-graph contradicts a service-name fork:** both builds use the same `APP_SERVICE` and `key_name_for_profile`. There is no `cfg(debug_assertions)` branch on the credential target.

| Observation (L3b) | Interpretation |
|-------------------|----------------|
| Release Welcome Back **DemoUser** · `keychainPresent: false` | No credential for resolved `profile_id` (likely `default`) under `app.obscur.desktop` / `nsec::default` |
| Parity Tester1 · `keychainPresent: true` | Prior unlock wrote wrapped nsec for that profile |
| Same AppData authority | On-disk profile DB can list DemoUser without OS keychain entry |

**Most likely root cause (not fixed yet):** release slot is a **different identity history** (DemoUser never successfully `init_native_session` → keychain write), not a dual service name. Import attempt that stayed on Welcome Back never completed write path.

**Secondary risks to probe before code:**

1. Windows Credential Manager ACL / integrity level differs for release exe vs `cargo run` (same service string, different caller SID).  
2. In-process `SESSION_SECRET_CACHE` masks miss on parity but cold release boot sees empty keychain.  
3. `resolve_profile_for_window` on release binds a profile id that never received a write.

---

## Next mutate (after maintainer accept)

1. L3b probe-only: on release Welcome Back, log `profile_id` + `Entry::new(APP_SERVICE, key)` NoEntry vs error (no secret in logs).  
2. If NoEntry: unlock/import Tester1 on **release** once → prove write + cold reopen (design priority).  
3. If ACL/error: only then consider keep-set around keyring error surfacing / retry — not a second service name.

---

## Claim language

| May say | When |
|---------|------|
| Investigated | This doc |
| Fixed (L3b) | Release unlock→shell + `keychainPresent: true` after cold start |
