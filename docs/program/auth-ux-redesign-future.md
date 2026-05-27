# Auth UX redesign — future versions (deferred)

**Status:** Design backlog — **not** in current ship path  
**Last updated:** 2026-05-24  
**Current policy (shipped):** [session-credential-policy](../../apps/pwa/app/features/auth/services/session-credential-policy.ts) — no remember-me / no auto-unlock across restarts  
**Handoff:** [current-session.md](../handoffs/current-session.md) — Phase 1/2 gates first

---

## Why this doc exists

Auth investigation (remember-me, device trust, persistence races) showed the monorepo auth stack is **high-cost to extend** and easy to misread in the UI. Rather than a major auth overhaul during Phase 2 DM work, we:

1. **Shipped** explicit policy: manual unlock every time (`AuthSessionPolicyNotice`).
2. **Document** a target model for a **future version lane** (this file).
3. **Continue** the default program order: native shell → Phase 2 DM → gates → Lane K / v2.0.

Reframing broken session persistence as “privacy by design” is only honest if daily login uses a **short device passphrase**, not repeated **private-key paste**—and if backup is first-class.

---

## Current model (as implemented)

| Step | User action | Stored on device |
|------|-------------|------------------|
| **Create** | Username + master password | Generated keypair; encrypted identity (`obscur.identity.record::{profileId}`) |
| **Restore once** | Import Key (`nsec` / hex) + optional password | Same encrypted record |
| **Every open** | Welcome back → username + password | Account record persists; **no** cross-restart auto-login |
| **Not offered** | OAuth / Google / Apple / third-party IdP | Self-custody only |

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

## Proposed future lanes (version TBD)

Assign to **v1.7.x+** or **post–Lane P** after Phase 2 / v1.9.x gates—**not** parallel with DM persistence.

| Lane | Scope | Out of scope |
|------|--------|--------------|
| **Auth-UX-1** | Copy, tab defaults (returning → Log In primary), de-emphasize Import Key, policy wording | Persistence rewrites |
| **Auth-UX-2** | Onboarding backup wizard: export file, QR optional, import from file | Remember-me / silent session |
| **Auth-UX-3** | Native biometric **unlock** of local vault (explicit user action per launch) | OAuth IdP |
| **Auth-UX-4** | Optional attestations / invite-only anti-abuse UI | Replacing key-based roots |

**One owner per path** — no parallel remember-me experiments in the same release as kernel or DM gates.

---

## Explicit non-goals (unless program reopens)

- Cross-restart “stay logged in” / remember-me (current policy off).
- Third-party verification as **required** login.
- Re-enabling community/coordination manual QA as a substitute for auth work.

---

## Related docs

| Doc | Role |
|-----|------|
| [phase1-desktop-shell-gate.md](./phase1-desktop-shell-gate.md) | Active — shell stability |
| [phase2-desktop-dm-persistence-gate.md](./phase2-desktop-dm-persistence-gate.md) | Active — DM restart |
| [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md) | Lane P / v2.0 after Lane K |
| [strategic-direction.md](./strategic-direction.md) | Program sequence |
| [03-identity-and-sybil.md](../archive/greenfield/03-identity-and-sybil.md) | Long-term identity / anti-abuse concepts |

---

## Exit criteria (when this lane starts)

1. Phase 2 DM gate signed off on maintainer machine.
2. Program assigns a version slice (e.g. v1.7.2 or dedicated patch) with **no** competing gateway/membership refactors.
3. Auth-UX-1 mock/copy approved before Auth-UX-2 persistence touches.
