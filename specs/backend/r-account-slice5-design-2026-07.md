# Design — R-ACCOUNT Slice 5 (create/unlock · package bootstrap parity)

**Status:** Design ready · **L3a pass** · **L3b fail** · next = keychain persist investigation (no product code yet)  
**Investigation:** [r-account-slice5-investigation-2026-07.md](./r-account-slice5-investigation-2026-07.md)  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**P2 gate:** [production-dev-parity-recovery-2026-07.md](./production-dev-parity-recovery-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Rust refactor Slice 5 — R-ACCOUNT design → parity P2 capture
PAUSED / CANCELLED:   community · relay-publish rewrite · dm-persist · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      profile bind → init_native_session/keychain → auth-kernel boot · data-root bind
PROOF BEFORE DONE:    P2 matrix below · L3 parity then release-exe · code only if release≠parity with owner named
OUT OF SCOPE:         Second unlock path · AUTH-SESSION-1 · db_*/relay subtract · UI-kit · P3 relays
```

---

## Target architecture (single path)

```
1. Profile slot (optional)
   desktop_create_profile / desktop_list_profiles
   → DesktopProfileState

2. Window bind
   desktop_bind_window_profile | isolation snapshot
   → desktop-profile-runtime.setSnapshot
   → setProfileScopeOverride + boot __OBSCUR_SYNC_PROFILE_SCOPE__
   (R-SCOPE — do not add writers)

3. Create / import / unlock identity (passphrase or nsec)
   auth-kernel-bound-profile-auth
   → assertAccountUnlockAllowedAsync (+ cross-profile lease)
   → init_native_session(nsec)  [Rust session + keychain write]
   → auth identity seed / runtime unlocked

4. Boot truth
   auth_boot_snapshot (restoreEligible as designed)
   → auth-kernel-boot-owner hydrate
   → main shell (not Welcome Back loop)

5. Storage plane
   data_root resolve (AppData pointer / custom) owns on-disk profile bytes
   — package vs parity divergence most likely here or OS keychain ACL
```

| Concern | Single owner | Must not |
|---------|--------------|----------|
| Profile slot | `DesktopProfileState` / `commands/profile.rs` | TS inventing parallel registry writers for desktop bind |
| Scope cell | R-SCOPE allowlist | New `setProfileScopeOverride` callers |
| Unlock + persist | `init_native_session` + `native_keychain` | Gateway silent unlock (AUTH-SESSION-1) |
| Boot hydrate | `auth_boot_snapshot` + boot-owner | Second F5 restore loop |
| Data root | `commands/data_root.rs` | Dual default roots without probe/reconnect |

---

## Mental simulation (one user action)

**Sender (user):** Opens packaged or parity desktop → creates slot or uses Default → enters passphrase (Tester1) or imports nsec → expects main shell.

**Receiver (system):** Window label → resolved `profileId` → unlock guard → `init_native_session` writes keychain for that profile → next paint / F5 uses `auth_boot_snapshot` for same profile → shell.

**Neighbor must not regress:** F5 restore (AUTH-KERN-1) · R-SCOPE allowlist · cross-profile lease (no “fix” by clearing leases) · P3 relays (out of this slice).

---

## P2 proof matrix

### Pass criteria (same on both surfaces)

| Check | Pass |
|-------|------|
| After unlock | Main shell / chat surface — not stuck on Welcome Back or infinite “Restoring…” |
| Scope | `auth_boot_snapshot.profileId` matches window bind / sync scope |
| Session | `get_session_status` active · keychain present for that profile (CDP invoke) |
| Digest | Prefer `auth.kernel_boot_restore_succeeded` or unlocked phase — not `kernel_boot_restore_exhausted` after fresh unlock |

### Layers

| Layer | Surface | Command / method |
|-------|---------|------------------|
| L1 | Unit / contract | Existing kern + profile-scope contracts; optional add: unlock-guard contract if subtract lands |
| L2 | Agent cargo | `cargo test -p libobscur session_scope` · `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml auth_boot` |
| L3a | **Parity** | `OBSCUR_CDP_MAIN=9230 pnpm dev:desktop` → MCP unlock Tester1 (`docs/program/obscur-dev-test-accounts.md`) → shell · optional create-profile path |
| L3b | **Release exe** | `pnpm desktop:build:exe` (rebuild shell) → run exe → same unlock/create · **required for “P2 fixed”** |
| L4 | Optional | Dual-window lease conflict still refuses same account — soak later |

**Claim rule:** Parity L3a alone = **implemented path observed**. **P2 verified / fixed** only after L3b.

---

## Evidence-gated implement slices (conditional)

Do **not** start code. Capture L3a then L3b. Branch:

| Outcome | Next |
|---------|------|
| L3a green · L3b green | Close Slice 5 as **verified** — no subtract |
| L3a green · L3b red | Diff capture: data-root probe + keychain read + boot snapshot wire → **one** owner subtract/repair design amend |
| L3a red | Repair on parity first (keep-set); re-use AUTH-KERN / R-SCOPE owners — no new unlock stack |
| Both red same symptom | Treat as shared owner (likely session/auth-kernel) — investigation amend before patch |

### Likely release-only failure owners (priority order)

1. **Data root** — install anchor / AppData pointer / custom redirect differs from parity cwd  
2. **Keychain ACL** — packaged exe identity cannot read/write nsec for profile  
3. **Shell bake** — stale offline shell (P1) masquerading as account fail — run `desktop:demo-preflight` / manifest first  
4. **Scope race** — already mitigated by R-SCOPE + AUTH-KERN; only reopen with attempt logs

### Forbidden “fixes”

- New bootstrap adapter beside `DesktopProfileBootstrap`  
- AUTH-SESSION-1 silent unlock  
- Clearing cross-profile leases to force unlock  
- Patching UI to hide failed `init_native_session`  
- Touching `relay-publish` / `dm-persist` / community  

---

## Immediate next atomic steps (ordered)

1. ~~**Agent L3a** — parity CDP unlock…~~ **Done** — [r-account-l3a-parity-2026-07-30.md](../../docs/handoffs/r-account-l3a-parity-2026-07-30.md)  
2. ~~**L3b** — release exe…~~ **Failed** — [r-account-l3b-release-2026-07-30.md](../../docs/handoffs/r-account-l3b-release-2026-07-30.md)  
   - Welcome Back **DemoUser** · `keychainPresent: false` · `auth.kernel_boot_restore_no_keychain`  
   - Data root AppData healthy · `APP_SERVICE` = `app.obscur.desktop` (same debug/release)  
3. **Next:** investigation amend — why `write_nsec_for_profile` does not survive process exit on this host (CM lag / cache-only Ok path) + why release WebView shows DemoUser vs parity Tester1 (webview user-data dir split).  
4. **Only then** smallest keep-set repair · re-run L3b.

---

## Explicit non-goals

- P3 relay online (separate band; PAUSED rewrite)  
- P4 F5 soak beyond AUTH-KERN already done (re-check only if account create corrupts restore)  
- Wallet / protocol / LES account surfaces  
- Merging `db_*` into `engine_invoke`  

---

## Claim language

| May say | When |
|---------|------|
| Designed | This doc |
| L3a observed | Parity CDP evidence attached |
| P2 verified | L3b release exe green |
| Fixed (runtime) | L3b green after a named subtract/repair matching an amended design |
| Implemented | Keep-set code landed matching amended design — still needs L3b to claim fixed |
