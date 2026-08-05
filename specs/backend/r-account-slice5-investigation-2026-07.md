# Investigation — R-ACCOUNT Slice 5 (package bootstrap · create/unlock parity)

**Status:** Investigation complete · design landed · 2026-07-30  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Product gate:** P2 in [production-dev-parity-recovery-2026-07.md](./production-dev-parity-recovery-2026-07.md)  
**Depends on:** R-SCOPE done · R-AUTH F5 done · RC1 cargo ops green · R-RELAY still PAUSED

---

## Session gate

```text
NEXT ATOMIC STEP:     Rust refactor Slice 5 — R-ACCOUNT investigation
PAUSED / CANCELLED:   community · relay-publish · dm-persist · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNERS (target): desktop profiles + session/keychain + auth-kernel unlock · data-root bind
PROOF BEFORE DONE:    design + L3 create/unlock on parity then release-exe (P2)
OUT OF SCOPE:         relay-publish / dm-persist subtract · UI-kit · website
```

---

## User action (P2)

```
Create profile slot (optional) → create/import identity → unlock
  → init_native_session + keychain write
  → auth-kernel / auth_boot_snapshot unlocked
  → main shell (not Welcome Back / profile picker stuck)
```

Same path must work on **parity-desktop** and **release exe** (no Dev Lab, no ambient dual stacks).

---

## Owner map (keep-set)

| Step | Owner | Surface |
|------|-------|---------|
| Profile slot CRUD / bind | Rust `DesktopProfileState` via `desktop_create_profile` / `desktop_bind_window_profile` | `commands/profile.rs` |
| Window ↔ profile | R-SCOPE: boot sync inject + `desktop-profile-runtime` override | TS + Rust snapshot |
| Unlock → native keys | `init_native_session` → `session.set_keys` + `native_keychain::write_nsec_for_profile` | `commands/session.rs` |
| Unlock guards | `assertAccountUnlockAllowedAsync` · cross-profile lease | `profile-account-unlock-guard` · `cross-profile-active-session-lease` |
| Boot restore | `auth_boot_snapshot` + auth-kernel boot-owner | AUTH-KERN-1 (done for F5) |
| Data root | `desktop_*_obscur_data_root*` | `commands/data_root.rs` — package install often diverges here |
| UI bootstrap shell | `DesktopProfileBootstrap` | providers — must not invent second session owner |

---

## Dual / risk bands (do not mutate PAUSED)

| Risk | Notes |
|------|-------|
| Data-root default vs custom | Release installer path ≠ dev `OBSCUR_*` / junction — classic package-only fail |
| Keychain OS ACL | Packaged exe identity may differ from `pnpm dev:desktop` host |
| Lease + multi-window | Cross-profile unlock blocked correctly — must not “fix” by deleting lease |
| Parallel identity writers | AUTH-SESSION-1 CANCELLED — no gateway scatter |

---

## Evidence still needed (before design subtract list)

1. **Parity CDP:** create fresh profile → unlock Tester-new or import → shell lands (agent-owned).  
2. **Release exe:** same path on `tauri build --no-bundle` / installer (maintainer or agent if artifact present).  
3. Diff: if parity green + release red → capture data-root + keychain digest; design targets that owner only.

Until release-red evidence exists, design should **not** invent a rewrite — only a proof plan + inventory of data-root/keychain call sites.

---

## Immediate non-code outputs

| Deliverable | Purpose |
|-------------|---------|
| This investigation | Owner map |
| Next: design | P2 proof matrix + smallest keep-set slice **only if** release fails with evidence |
| Forbidden until evidence | New bootstrap adapter · second unlock path |

---

## Claim language

| May say | When |
|---------|------|
| Investigated | This doc |
| Designed | Design with proof matrix + conditional subtract |
| P2 verified | Create/unlock green on **release exe** (L3) — parity alone insufficient |
