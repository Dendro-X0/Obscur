# v1.5.8 — Desktop regression (U4) + Phase 1 exit

**Release line:** v1.5.8  
**Tester:** _____________ **Date:** _____________  
**Build:** Desktop PWA or Tauri shell at `1.5.8`

**Related:**
- **G1 (required for Phase 1 exit):** [v1.5.7 manual matrix](../v1.5.7/README.md) — rename + expel sign-off
- **Baseline regressions:** [v1.5.4 manual verification](../v1.5.4/manual-verification.md)

---

## U4 — Publish / upload user copy (no raw `reasonCode`)

Simulate failures by disabling all relays in **Settings → Relays** (or disconnect network) unless noted.

| ID | Step | Expected user-facing copy (not raw codes) | Pass |
|----|------|-------------------------------------------|------|
| U4-1 | DM: send one message with relays offline | Toast mentions **writable relays** / connection — not `no_writable_relays` or stack trace | ☐ |
| U4-2 | Community: send chat message with relays offline | Same class of message as U4-1 (community scope) | ☐ |
| U4-3 | Community: open Management → propose rename (2+ members) with relays offline | Governance publish failure in plain language | ☐ |
| U4-4 | Settings: profile save with **one** relay enabled and others failing (partial) | Degraded / **partial (n/m)** style warning if applicable | ☐ |
| U4-5 | Composer: attach a file; force upload failure (oversized file or offline) | Upload error uses timeout / provider / size copy — not `UploadErrorCode` enum | ☐ |

**Pass bar:** No toast or inline error shows snake_case `reasonCode`, HTTP status-only text, or `overallError` relay jargon without explanation.

---

## G1 — Phase 1 community (link)

Complete sign-off in [v1.5.7/README.md](../v1.5.7/README.md):

| ID | Required | Pass |
|----|----------|------|
| G1.1 | Two-member rename approve → descriptor | ☐ |
| G1.2 | Three-member expel via governance | ☐ |
| G1.3 | Tie vote close (optional) | ☐ |

---

## P1-exit — Phase 1 checkpoint (after G1 + U4)

| Criterion | Evidence |
|-----------|----------|
| Descriptor + governance on desktop | G1.1 + G1.2 signed off |
| Publish copy regression | U4-1 … U4-5 signed off |
| Automated gate | `pnpm release:test-pack` green on release commit |

---

## Sign-off

| Block | Date | Notes |
|-------|------|-------|
| U4 | | |
| G1 | | See v1.5.7 matrix |
| P1-exit | | |
