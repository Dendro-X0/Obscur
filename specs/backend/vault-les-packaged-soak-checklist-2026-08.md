# Checklist — Vault / LES packaged soak (post v1.9.15)

**Date (UTC):** 2026-08-09  
**Status:** **Pass / Verified** (maintainer packaged L3 · Tor OFF)  
**Parents:** [v1.9.13-scope.md](../../docs/program/v1.9.13-scope.md) R6b · [v1.9.15-release.md](../../docs/releases/v1.9.15-release.md) · [CURRENT.md](../../docs/CURRENT.md)

```text
HANDOFF:  Vault LES packaged soak Pass · next = maintainer choose band
PAUSED:   Community · AUTH-SESSION · Tor Verified (env)
OUT:      Claiming Tor Verified · groups/** patches without charter
```

## Why this band

`v1.9.15` is tagged (`v1.9.15` @ DM/media L3 Pass). Docs say Vault/LES was shipped in 1.9.11–13 but **packaged desktop soak** is still the next product proof — independent of Tor.

## Preconditions

| Item | Expected |
|------|----------|
| Tor | **OFF** (this host) |
| Desktop | Packaged build preferred, or `pnpm dev:desktop:online` production-parity shell |
| L1 (optional agent) | `pnpm verify:les-l1` green |

## Matrix (maintainer)

| # | Action | Pass |
|---|--------|------|
| V1 | Unlock → Settings / Vault reachable | Shell loads |
| V2 | **Secure Upload** image + short video | Both in Vault grid |
| V3 | Open video before decrypt finishes | Loading → play (not stuck unavailable) |
| V4 | Close lightbox · reopen · soft refresh | Still plays |
| V5 | Chat → **Save to Vault** (if enabled in this build) | Row in Vault; toast after commit |
| V6 | Second profile | No cross-profile LES bleed |
| V7 | Remove from Vault | Gone after refresh |
| V8 | Lock app · unlock · Vault still lists items | Persist across lock |

## Claim language

| May say | When |
|---------|------|
| Vault soak **Pass** | V1–V4 + V7 (+ V5 if chat-save enabled) on packaged or parity desktop |
| Vault Verified | Pass + handoff stamp date |
| Not required | Tor ON · community · AUTH-SESSION |

## Evidence paste

```text
Vault LES soak:
  V1–V8: Pass (maintainer summary 2026-08-09)
  Notes: Secure Upload + Remove from Vault · profile isolation · group chat OK · Tor unavailable (expected on this host)
  Surface: packaged
  Stamp: Obscur_1.9.15_x64-setup.exe (desktop:package 2026-08-09)
```
