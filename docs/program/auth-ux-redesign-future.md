# Auth UX redesign — future versions (deferred)

**Status:** Design backlog — **not** in current ship path  
**Last updated:** 2026-06-12  
**Current policy (shipped):** [session-credential-policy](../../apps/pwa/app/features/auth/services/session-credential-policy.ts) — desktop: no browser unlock tokens; OS keychain path attempted in v1.9.6 and **deferred** ([v1.9.6-session-persistence-redesign.md](./v1.9.6-session-persistence-redesign.md) § Feasibility decision)  
**Handoff:** [current-session.md](../handoffs/current-session.md)

---

## Why mainstream “remember me” does not apply

Obscur is **self-custody / decentralized-by-design**:

- **No email, phone, or OAuth roots** — there is no centralized IdP, session table, or “forgot password” server. Adding Google/GitHub/Better Auth-style flows would not fix unlock on restart; it would introduce a **second identity root** that contradicts the product model.
- **Long-lived secret on first bind** — a new device still needs the **private key once** (import). No third-party login removes that step; it only moves trust to someone else’s server.
- **Web-app session cookies ≠ desktop E2EE vault** — “persistent login” in a typical SaaS app means a server remembers a session id. Here, unlock means **decrypt local identity + load native SQLite** under an explicit `profileId` and window scope. That is a different problem with stricter owners and cold-boot races (see v1.9.6 feasibility note).

**Consequence:** Making daily auth “as convenient as Instagram” is **not a small feature** — it is a **redesign** (device passphrase tier, backup story, single boot owner, optional biometrics). That redesign is **unnecessary for current program goals**; v1.9.6 explored OS keychain “stay signed in” and stopped after the feasibility gate without manual restart agreement.

**Honest UX today:** Users may store keys locally (text file, password manager, encrypted backup) — that is compatible with self-custody. The product should **not** pretend web-style remember-me works when it does not.

---

## Current model (as implemented)

| Step | User action | Stored on device |
|------|-------------|------------------|
| **Create** | Username + master password | Generated keypair; encrypted identity (`obscur.identity.record::{profileId}`) |
| **Restore once** | Import Key (`nsec` / hex) + optional password | Same encrypted record |
| **Every open (today)** | Welcome back → password **or** import key | Account record persists; **cold restart → login screen** (keychain restore deferred) |
| **Not offered** | OAuth / Google / Apple / email / phone IdP | Self-custody only — **will not add** as auth roots |

**Code owners:** `auth-screen.tsx`, `use-identity.ts`, `auth-gateway.tsx`, `window-runtime-supervisor.ts`, `identity-persistence.ts`, `session-credential-policy.ts`.

**Greenfield alignment:** [03-identity-and-sybil.md](../archive/greenfield/03-identity-and-sybil.md) — local keys; optional attestations later as badges, not roots.

---

## Problems to fix (future, not now)

| Issue | Risk |
|-------|------|
| UI implies “key-only” daily login | Users paste 64-char secrets into Notepad |
| Import Key tab competes with Log In | Returning users pick the wrong path |
| Backup is buried in Settings | Key loss with no recovery story at onboarding |
| Auth touches many runtime owners | Small UX changes have large blast radius |

---

## Target model — two secrets, two jobs

```text
Private key   →  identity (who you are)     →  ONCE per device + serious backup
Passphrase    →  unlock (decrypt local vault)  →  EVERY app open (policy: manual)
```

**Not in scope for Obscur roots:** mandatory email/phone/OAuth login.  
**Optional later (badges only):** attestations per greenfield Tier D.

---

## Non-traditional directions (only viable exploration space)

These fit decentralized/self-custody constraints. They are **not** v1.9.x scope unless program reopens an auth lane.

| Direction | Idea | Fits Obscur because |
|-----------|------|---------------------|
| **Device passphrase tier** | Private key **once** per device; daily unlock = short local passphrase only | Same encrypted identity record; no central server |
| **First-class backup** | Onboarding + Settings push encrypted export / file backup before “you’re done” | Reduces `.txt` key files without cloud IdP |
| **OS secure storage + single boot owner** | Rust hydrates keychain **before** React identity (v1.9.6 lesson) | Same keychain model, new architecture — not more TS patches |
| **Biometric gate** | Unlock **local vault** per launch (explicit user gesture) | No password on wire; still no OAuth |
| **Profile windows (Chrome-like)** | One account per window; picker without re-auth across windows | Already partial; improves UX without global session |
| **New-device pairing** | QR / file transfer of encrypted bundle between **your** devices | Still user-operated; not “sign in with Google” |
| **Local login assist** (Chrome-style) | ~~Save username + password locally~~ | **Withdrawn** v1.9.7 — [local-login-assist-charter.md](./local-login-assist-charter.md) |
| **Auth Assistant** (Authenticator-style) | **Deferred** — parallel unlock IPC failed AA-1 | [obscur-auth-assistant-charter.md](./obscur-auth-assistant-charter.md) |

**Explicitly out of scope:** Better Auth / OAuth / SMS / email magic links as **login roots**; browser `localStorage` unlock tokens on desktop (policy forbids); silent remember-me cold boot (v1.9.6 deferred).

---

## Proposed future lanes (version TBD)

Assign to **v1.7.x+** or **post–Lane P** after Phase 2 / v1.9.x gates—**not** parallel with DM persistence.

| Lane | Scope | Out of scope |
|------|--------|--------------|
| **Auth-UX-1** | Copy, tab defaults (returning → Log In primary), de-emphasize Import Key, policy wording | Persistence rewrites |
| **Auth-UX-2** | Onboarding backup wizard: export file, QR optional, import from file | Remember-me / silent session |
| **Auth-UX-3** | Native biometric **unlock** of local vault (explicit user action per launch) | OAuth IdP |
| **Auth-UX-4** | Optional attestations / invite-only anti-abuse UI | Replacing key-based roots |
| **Auth-UX-5** | **Auth Assistant** — desktop panel + mobile sheet; tap-to-unlock ([charter](./obscur-auth-assistant-charter.md)) | Silent remember-me; browser extension key storage |

**One owner per path** — no parallel remember-me experiments in the same release as kernel or DM gates.

---

## Explicit non-goals (unless program reopens)

- Mainstream **remember-me** / server session persistence (web SaaS model).
- Third-party IdP as **required** or **primary** login.
- v1.9.6-style **incremental** keychain restore patches without AUTH-SESSION-1 or Rust-first boot owner.
- Reframing “login every cold start” as fixed without evidence — copy must match behavior.

---

## Related docs

| Doc | Role |
|-----|------|
| [phase1-desktop-shell-gate.md](./phase1-desktop-shell-gate.md) | Active — shell stability |
| [phase2-desktop-dm-persistence-gate.md](./phase2-desktop-dm-persistence-gate.md) | Active — DM restart |
| [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md) | Lane P / v2.0 after Lane K |
| [strategic-direction.md](./strategic-direction.md) | Program sequence |
| [obscur-auth-assistant-charter.md](./obscur-auth-assistant-charter.md) | Authenticator-inspired tap-to-unlock (replaces remember-me path) |

---

## Exit criteria (when this lane starts)

1. Phase 2 DM gate signed off on maintainer machine.
2. Program assigns a version slice (e.g. v1.7.2 or dedicated patch) with **no** competing gateway/membership refactors.
3. Auth-UX-1 mock/copy approved before Auth-UX-2 persistence touches.
