# Investigation — AUTH-KERN cold hydrate (P2 Welcome Back vs native unlocked)

**Status:** Investigation complete · 2026-07-31  
**Trigger:** P2 unlock→shell UI soak **Fail** — [r-account-p2-ui-soak-2026-07-30.md](../../docs/handoffs/r-account-p2-ui-soak-2026-07-30.md)  
**Prior:** AUTH-KERN-1 F5 repair **Pass** — [auth-kern-1-f5-session-loss-investigation-2026-07.md](./auth-kern-1-f5-session-loss-investigation-2026-07.md) (explicitly **does not** prove cold process restore)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  P2 unlock→shell soak (next after web L3) → AUTH-KERN cold hydrate charter
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      auth-kernel-boot-owner + ensureInitialized cold wait · tryNativeSessionUnlock (keep-set)
PROOF BEFORE DONE:    Design amend + L1 kern contracts · L3 cold relaunch release exe (not F5 alone)
OUT OF SCOPE:         AUTH-SESSION-1 silent unlock · community · UI Welcome Back copy patch · claiming P2 fixed from this doc alone
```

---

## Observed (P2 release soak)

| Probe | Result |
|-------|--------|
| UI cold | **Welcome Back · DemoUser** |
| Tester1 password unlock | **Incorrect password** (expected if slot password is DemoUser) |
| `get_session_status` | `is_active: true` · DemoUser pubkey |
| `auth_boot_snapshot` | `phase: unlocked` · `keychainPresent: true` · `profileId: default` · `restoreEligible: true` |
| Wincred | `nsec::default…` present (L3b still Pass) |

**Verdict class:** Native/Rust hydrate **already succeeded**; JS identity stayed **locked** → gate forever. Fixture Tester1≠DemoUser is a **separate** soak discipline issue.

---

## Hypotheses

| ID | Claim | Verdict |
|----|-------|---------|
| H1 | Keychain missing / L3b regress | **Ruled out** — `keychainPresent: true` + Wincred |
| H2 | AUTH-KERN-1 F5 path broken again | **Out of band** — P2 is **cold process**, not F5; F5 already Pass |
| **H3** | Cold `ensureInitialized` does **not** await boot restore; sets `locked` + keychainPresent and returns | **Confirmed (code)** — `use-identity.ts` waits `waitForAuthKernelBootRestore` only when `isPageReloadNavigation()` |
| **H4** | `bootRestoreSettled` initializes `true` on cold (`!isPageReloadNavigation`) so gateway/wait treat settle as done before cold restore finishes | **Confirmed (code)** — `auth-kernel-boot-owner.ts` init |
| **H5** | Cold `tryNativeSessionUnlock` runs cross-window lease assert; F5 skips it — stale lease → `"inactive"` while Rust still active | **Plausible** — lines ~637–647 `use-identity.ts`; needs L3 digest on next soak |
| H6 | Boot owner ignores `phase: unlocked` and only succeeds via `retryAuthKernelNativeSessionUnlock` | **Confirmed (code)** — no short-circuit on unlocked phase |
| H7 | Wrong account (Tester1 vs DemoUser) is root of hydrate fail | **Ruled out as hydrate root** — wrong password explains UI Log In fail; does **not** explain native unlocked + JS locked |

---

## Canonical owners (keep-set)

| Concern | Owner |
|---------|--------|
| Boot restore loop | `auth-kernel-boot-owner.ts` → `runAuthKernelBootRestore` |
| Cold profile reconcile + kick restore | `desktop-window-boot.ts` (already calls restore with `skipBootWait: true`) |
| Identity apply from native session | `tryNativeSessionUnlock` / `retryNativeSessionUnlockAction` |
| Rust truth | `auth_boot_snapshot` / `force_session_restore` |

**Must not:** Second restore owner in `auth-gateway` · revive AUTH-SESSION-1 scatter · flip Welcome Back copy instead of consume native unlocked.

---

## Mental simulation

1. Cold launch release exe → Rust session already in-memory or keychain-restored → `phase: unlocked`.
2. JS `ensureInitialized` finds stored DemoUser, **skips** wait (not reload), sees keychain → **locked awaiting restore** → Welcome Back paints.
3. Background `runAuthKernelBootRestore` may run; if `retryAuthKernelNativeSessionUnlock` returns false (lease / race / exhausted), UI stays gated forever while CDP still shows native active.
4. User types Tester1 password → Incorrect password (DemoUser secret) — expected; does not unlock hydrate.

**Neighbor must not regress:** F5 AUTH-KERN-1 · manual lock · cross-profile lease on true multi-window conflict · L3b keychain persist.

---

## Fixture note (P2 re-soak)

| Goal | Discipline |
|------|------------|
| Prove hydrate | Cold relaunch → shell for **whatever** identity occupies `default` (DemoUser OK) without password when native unlocked |
| Prove Tester1 package | Bind/import Tester1 into slot first (or clear DemoUser) — do not fail hydrate on wrong password alone |

---

## Next

Design: `specs/backend/auth-kern-cold-hydrate-design-2026-07.md` — smallest keep-set repair; L1 + cold L3 proof; then implement only that slice.
