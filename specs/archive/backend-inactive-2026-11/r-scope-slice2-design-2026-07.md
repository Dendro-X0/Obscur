# Design — R-SCOPE Slice 2 (profile-scope single owner)

**Status:** Implemented (L1) · 2026-07-30  
**Investigation:** [r-scope-slice2-investigation-2026-07.md](./r-scope-slice2-investigation-2026-07.md)  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Rust refactor Slice 2 — R-SCOPE design → implement
PAUSED / CANCELLED:   community · relay-publish rewrite · dm-persist · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      desktop-profile-runtime (override) + desktop-window-boot-payload / layout (sync inject)
PROOF BEFORE DONE:    L1 owner-contract tests · L3 unlock→F5 still green (agent CDP)
OUT OF SCOPE:         relay/dm dual-owner mutate · new scope APIs · AUTH-SESSION-1
```

---

## Verdict from investigation

CodaCtrl “7 writers” is mostly **path heuristic noise**. Production truth:

| Mechanism | Production writers | Role |
|-----------|-------------------|------|
| `setProfileScopeOverride` | **Only** `desktop-profile-runtime.ts` (`setSnapshot`) | Ongoing window bind after Rust snapshot / bind |
| `__OBSCUR_SYNC_PROFILE_SCOPE__` | `desktop-window-boot-payload.ts` + early `layout.tsx` inject | Pre-React / first-paint scope before runtime refresh |

All other `setProfileScopeOverride` call sites are **tests only**.

`auth-kernel-profile-scope.ts` is assert/match only — keep as reader.

---

## Target ownership (do not add writers)

```
Boot / first paint
  layout.tsx + applyDesktopWindowBootPayload
    → __OBSCUR_SYNC_PROFILE_SCOPE__
Native refresh / bind
  desktop_bind_window_profile | desktop_get_profile_isolation_snapshot
    → desktopProfileRuntime.setSnapshot
      → setProfileScopeOverride(profileId)
Reads (desktop)
  resolveIdentityScopeProfileId / getProfileScopeOverride / getResolvedProfileId
    → prefer sync inject, then override, then registry
```

| Concern | Owner |
|---------|--------|
| Sync inject write | `desktop-window-boot-payload.ts` (+ layout bootstrap that mirrors boot) |
| Override write | `desktop-profile-runtime.ts` only |
| Scope cell + key helpers | `profile-scope.ts` (primitive) |
| Auth match | `auth-kernel-profile-scope.ts` (read-only) |
| Pure resolve helper | `resolve-desktop-window-profile-scope.ts` |

---

## Implement slice (smallest)

1. **Document** ownership on `profile-scope.ts` (English comment: who may write override / sync).  
2. **L1 contract** — production call-site allowlist:
   - `setProfileScopeOverride(` → only `desktop-profile-runtime.ts` under `app/` (exclude `*.test.*`)
   - `__OBSCUR_SYNC_PROFILE_SCOPE__ =` → only `desktop-window-boot-payload.ts` + `layout.tsx`
3. **No subtract of working paths** — nothing to delete; enforce so future dual-owners fail CI.  
4. **Proof:** run new contract + existing profile-scope / desktop-window-boot tests; agent F5 smoke if desktop still up.

---

## Explicit non-goals

- Rewriting `resolveIdentityScopeProfileId` call graph  
- Merging sync inject into override (would risk first-paint race)  
- Touching community/groups tests that set override for isolation fixtures  
- Slice 3 Rust command catalog (next charter step)

---

## Claim language

| May say | When |
|---------|------|
| Designed | This doc |
| Implemented | Allowlist contract green + ownership comment |
| Verified (L1) | Named vitest pass |
| Fixed (dual-owner) | Heuristic clarified + CI prevents new production writers |
