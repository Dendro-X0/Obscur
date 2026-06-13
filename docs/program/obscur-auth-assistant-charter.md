# Obscur Auth Assistant — charter (Authenticator-inspired)

**Status:** **Deferred (infeasible for v1.9.x)** — AA-1 spike reverted 2026-06-13 after iterative runtime testing failed to produce reliable save/list/unlock on desktop.  
**Last updated:** 2026-06-13  
**Replaces (conceptually):** cross-restart “Remember me” / silent keychain restore ([v1.9.6-session-persistence-redesign.md](./v1.9.6-session-persistence-redesign.md) § Feasibility decision)  
**Related:** [auth-ux-redesign-future.md](./auth-ux-redesign-future.md) · `rules/05-auth-and-identity.md`

---

## Feasibility decision (2026-06-13)

AA-1 desktop implementation (title-bar panel, OS keychain vault, save prompt, auto-fill) **did not work reliably in manual testing** — saved credentials never appeared in the assistant after sign-in; the UX implied one-tap unlock without delivering evidence-backed outcomes.

Per `rules/11-feasibility-and-modular-safety.md`, **Auth Assistant is deferred** alongside silent cold-boot remember-me. **Canonical desktop unlock:** manual passphrase / import key on the auth screen; optional **Stay signed in on this device** checkbox (native keychain via existing `init_native_session` path — restart restore remains separately deferred).

**Do not re-land** Auth Assistant UI or IPC without a new architecture path and AUTH-ASSIST-1 programmatic gate passing first.

---

## Problem

Users must unlock Obscur with **wallet-grade secrets** (master passphrase and/or `nsec`/hex on first bind). Copy-paste from Notepad is tolerable on desktop; on **mobile it is unacceptable**. v1.9.6 “stay signed in” attempted **silent** OS keychain restore on cold boot and hit a feasibility wall (profile boot races, multi-window scope, static shell dev friction).

**Product truth:** Self-custody and decentralized deployment rule out email/OAuth/Better Auth-style session servers. Convenience must come from **local, user-initiated** patterns—not from pretending the app is a normal SaaS login.

---

## Core idea (Authenticator analogy)

Google Authenticator / similar 2FA apps solve a **different** crypto problem (TOTP codes), but the **UX pattern** transfers:

| Authenticator | Obscur Auth Assistant |
|---------------|------------------------|
| List of labeled accounts (Google, GitHub) | List of labeled **Obscur profiles / identities** on this device |
| One tap → show code → copy or autofill | One tap → **unlock this profile** (passphrase or bound key) |
| Secrets stored locally in app/extension vault | Secrets in **OS secure storage** or assistant-owned encrypted vault |
| User opens assistant when site asks for 2FA | User opens assistant when Obscur shows login — **explicit gesture** |
| No server holds the TOTP secret | No Obscur server holds unlock material |

**What we do not copy:** storing raw private keys in a **browser extension** `localStorage` blob, or silent autologin without user action.

**What we do copy:** **low-friction, labeled, tap-to-use** local vault UX that removes copy-paste gymnastics—especially on mobile.

---

## Design principle: assisted unlock, not silent remember-me

```text
Remember me (deferred)     →  App cold-starts already unlocked (failed: boot orchestration)
Auth Assistant (proposed)  →  App cold-starts on login screen; user taps account → unlock in one gesture
```

This **avoids** the v1.9.6 failure mode:

- No requirement that React identity, window runtime, and keychain hydrate in perfect order **before first paint**.
- Unlock happens **after** shell is up, via **one canonical IPC path** triggered by user tap.
- Mobile can use the same contract (sheet / autofill / biometric gate) without pasteboard.

---

## User flows

### First time on a device (unchanged)

1. Import private key **once** (or create identity).
2. Set master passphrase (recommended).
3. Assistant prompts: **“Save unlock for this device?”** → stores **passphrase** (or key handle in OS vault), **not** in browser `localStorage`.

### Every day (desktop)

1. Open Obscur → Welcome back / sign-in (expected).
2. Open **Auth Assistant** (title-bar chip, tray menu, or keyboard shortcut)—same mental model as opening Authenticator.
3. Tap **Tester1** → optional OS biometric → Obscur unlocks (fill + submit, or native `unlock_profile` command).
4. No Notepad, no 64-char paste.

### Every day (mobile — priority surface)

1. Open Obscur → login screen.
2. **Option A:** In-app assistant sheet — pinned accounts, tap → biometric → unlock.
3. **Option B (later):** OS **Autofill / Credential Provider** extension surfaces Obscur accounts in the keyboard/autofill bar (iOS ASCredentialProvider, Android AutofillService).
4. **Option C:** Long-press paste replaced by **“Unlock from saved account”** — never expose full key on clipboard.

### Dev mode

- Dev Lab keeps programmatic `window.obscurDevLab.unlockAccount()` for automation.
- Assistant is the **human** path; Dev Lab is the **CI** path—same unlock owner underneath.

---

## Security model

| Rule | Rationale |
|------|-----------|
| **One owner** | `auth-assistant` module owns saved unlock entries + unlock IPC; no parallel remember-me flags in `auth-gateway` |
| **Explicit user gesture** | Every unlock requires tap (+ biometric where available); no silent cold-start restore in v1 |
| **Passphrase-first daily material** | Assistant stores **master passphrase** for returning users; raw `nsec`/hex only at first import (or OS key handle, never logged) |
| **OS secure storage** | Desktop: keychain/credential manager via Tauri; mobile: Keystore/Keychain; **never** desktop browser tokens |
| **Per-profile isolation** | Each desktop profile window has its own assistant entries scoped by `profileId` |
| **Revocable** | “Remove from assistant” ≠ log out of relays; clears saved unlock material only |
| **Copy honesty** | UI never claims “you’re logged in forever”; claims “one tap to unlock on this device” |

---

## Architecture sketch

```text
┌─────────────────────────────────────┐
│  Auth Assistant UI (native shell)   │  ← list, tap, biometric gate
│  - Tauri panel / mobile sheet       │
└──────────────┬──────────────────────┘
               │ single command
               ▼
┌─────────────────────────────────────┐
│  auth-assistant-service (Rust/TS)   │  ← ONE owner: read vault, unlock IPC
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Existing unlock path               │  ← unlockBoundProfile / init_native_session
│  window-runtime-supervisor          │     (no new parallel unlock in React)
└─────────────────────────────────────┘
```

**Not in scope for v1 of assistant:** rewriting `AuthGateway` auto-restore effects; new cold-boot redirect logic; browser extension for arbitrary sites.

---

## Phased delivery

| Phase | Scope | Gate |
|-------|--------|------|
| **AA-0** | Charter + UX mock + copy (“Use Auth Assistant, not paste”) | Doc review |
| **AA-1 Desktop** | Tauri side panel or title-bar popover; save passphrase after successful login; tap-to-unlock current profile | Manual: login → save → restart → tap unlock (no paste) |
| **AA-2 Mobile in-app** | Bottom sheet, biometric gate, same vault API | Manual on APK: tap unlock without clipboard |
| **AA-3 OS autofill** | Platform credential provider (optional, platform-specific) | Platform smoke checklist |
| **AA-4 Import helper** | QR / file pick for **first** key import only; assistant never replaces backup story | Paired with Auth-UX-2 backup wizard |

**Explicitly deferred forever (unless program reopens):** silent remember-me on cold boot without user gesture.

---

## Comparison to abandoned path

| | v1.9.6 stay signed in | Auth Assistant |
|--|----------------------|----------------|
| User action on restart | None (intended) | One tap |
| Boot complexity | High (race-prone) | Low (unlock after shell ready) |
| Mobile fit | Poor | Primary target |
| Failure mode | Blank shell / login loop / false “fixed” | Assistant empty → user imports once again |
| Debug style | Incremental TS patches | New module + IPC contract + programmatic gate |

---

## Non-goals

- OAuth / email / phone login roots.
- Cloud-synced password vault (1Password-style hosted service).
- Storing unlock secrets in PWA `localStorage` on desktop.
- Chrome Web Store extension that holds production keys (dev-only mock OK for UX prototyping).
- Replacing encrypted `.obscur-profile` backup / export story.

---

## Verification (when implemented)

Programmatic:

- `AUTH-ASSIST-1`: save entry → process restart → `assistant_unlock(profileId)` → identity unlocked without clipboard.

Manual:

- Mobile: unlock without switching apps to Notes/password manager.
- Desktop: two profile windows — assistant shows **scoped** entries only for bound profile.

---

## Program placement

Assign **after** v1.9.5 Phase B/C sign-off or explicit maintainer charter in handoff—not parallel with dm-kernel or workspace-kernel gates.

**Next atomic step (when reopened):** AA-0 mock + AA-1 spike in Tauri (side panel listing one saved passphrase unlock)—**no** changes to `AuthGateway` restore effects.
