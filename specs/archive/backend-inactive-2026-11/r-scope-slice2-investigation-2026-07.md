# Investigation — R-SCOPE Slice 2 (profile-scope single owner)

**Status:** Investigation only · 2026-07-30 · **no code** until design + handoff confirm subtract list  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Why first:** Dual-owner `profile-scope` (7 writers) sits under keep-set and blocks clean Rust session bind; `relay-publish` / `dm-persist` remain PAUSED

---

## Session gate

```text
NEXT ATOMIC STEP:     Rust refactor Slice 2 — R-SCOPE investigation
PAUSED / CANCELLED:   community · relay-publish rewrite · dm-persist · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER (target): desktop window bind → setProfileScopeOverride via desktop-profile-runtime only
PROOF BEFORE DONE:    L1 scope/kern contracts · L3 unlock→F5 still green
OUT OF SCOPE:         Adding writers · un-pausing relay/dm · UI-kit
```

---

## Heuristic writers (CodaCtrl) → role triage

| Path | Real role (code) | Slice action |
|------|------------------|--------------|
| `profiles/services/profile-scope.ts` | **Storage key + override cell** (`setProfileScopeOverride`) | Keep as **primitive store** — not a second “policy owner” |
| `profiles/services/desktop-profile-runtime.ts` | **Only binder that writes override** via `setSnapshot` → `setProfileScopeOverride` after Rust `desktop_bind_window_profile` / refresh | **Canonical desktop writer** |
| `profiles/services/resolve-desktop-window-profile-scope.ts` | Pure resolver (cache vs boot) — **no mutate** | Keep as **reader/helper** (heuristic false positive as writer) |
| `auth-kernel/auth-kernel-profile-scope.ts` | Match/assert helpers for auth-kernel | Keep as **reader/assert** — must not call `setProfileScopeOverride` |
| `auth/hooks/use-identity.ts` | Calls `bindCurrentWindowProfile` / `resolveIdentityScopeProfileId` | Demote: bind only through `desktopProfileRuntime`; no direct override writes |
| `auth/components/auth-gateway.tsx` | Consumes scope for shell gating | **Reader** — subtract any direct scope writes if found |
| `search/hooks/use-identity-resolver.ts` | Name resolution | **Reader** |
| `settings/.../use-identity-settings-model.ts` | Settings model | **Reader** |

**Working verdict:** Path heuristic over-counts. True **mutate** of ambient scope is concentrated in `desktop-profile-runtime.setSnapshot` → `setProfileScopeOverride`. Parallel **read** paths (`resolveIdentityScopeProfileId`, registry, boot payload) must agree with that bind, not invent a second override.

---

## Canonical path (target)

```
Rust desktop_bind_window_profile / isolation snapshot
  → desktopProfileRuntime.setSnapshot
    → setProfileScopeOverride(profileId)
      → getResolvedProfileId / resolveIdentityScopeProfileId reads
        → identity storage keys + auth_boot expected profile
```

| Concern | Single owner |
|---------|----------------|
| Window↔profile bind (desktop) | `desktop-profile-runtime.ts` + Rust profile commands |
| Scope override cell | `profile-scope.ts` (primitive; written only by runtime above) |
| Auth asserts | `auth-kernel-profile-scope.ts` (read-only match) |
| Pre-React resolve | `resolve-desktop-window-profile-scope.ts` + boot payload (read) |

---

## Rust alignment

| Command / module | Role |
|------------------|------|
| `desktop_bind_window_profile` | Authoritative bind |
| `desktop_get_profile_isolation_snapshot` | Refresh truth |
| `auth_boot_snapshot` / `force_session_restore_for_window` | Consume window-bound `profile_id` — must not rebind except documented non-strict paths |

Slice 2 TS subtraction must not add a second Rust bind path. Slice 3 (R-RUST-BOUNDARY) inventories remaining Tauri commands.

---

## Mental simulation

| Action | Expected |
|--------|----------|
| Unlock Tester1 on main | Bind `default` · override = default · F5 restores |
| Open second profile window | Separate window label · bind that profile · no cross-override on main |
| F5 after unlock | Boot payload / last-known → same profileId · auth-kernel restore |

Regression to watch: F5 `missing_stored_identity` (fixed in R-AUTH) if scope resolves wrong before identity load.

---

## Subtract candidates (design next)

1. Grep `setProfileScopeOverride` — only `desktop-profile-runtime` may call it (enforce via lint/test).  
2. Confirm `auth-gateway` / settings / search never write override.  
3. Document `resolveIdentityScopeProfileId` as the only **read** entry for auth/identity (desktop).  
4. Optional: demote registry `getActiveProfileId` behind window scope on native (already mostly true via override).

---

## Proof plan (after design + impl)

| Layer | Command |
|-------|---------|
| L1 | Existing profile-scope / desktop-window-boot / auth-kernel-kern tests |
| L1 new | Contract: `setProfileScopeOverride` call sites = 1 module |
| L3 | Agent CDP unlock→F5→Tester1 shell (parity) — must stay green |

---

## Claim language

| May say | When |
|---------|------|
| Investigated | This doc |
| Designed | `r-scope-slice2-design-2026-07.md` with exact subtract file list |
| Implemented | Diff matches design · keep-set only |
| Fixed | L3 F5 still green + single override writer proven |
