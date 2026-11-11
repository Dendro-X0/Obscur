# OB5 — Official Beta cut plan (publish on ask)

**Date:** 2026-11-11  
**Status:** **PUBLISHING** · maintainer ask `publish Official Beta` received · tag **v2.0.0-beta.11**  
**Parents:** [official-beta-bar-2026-11-11.md](./official-beta-bar-2026-11-11.md) · [official-beta-ob4-product-chrome-2026-11-11.md](./official-beta-ob4-product-chrome-2026-11-11.md) · foundation [remaster-r5-beta-cut-plan-2026-11-10.md](./remaster-r5-beta-cut-plan-2026-11-10.md) (beta.10)  
**Draft notes:** [docs/releases/official-beta-release-notes-draft-2026-11-11.md](../../docs/releases/official-beta-release-notes-draft-2026-11-11.md)

```text
HANDOFF ATOMIC STEP: OB5 Official Beta cut plan READY — Continuity Pass / Soft L3 Fixed not claimed · WAITING publish ask
PAUSED / CANCELLED: Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote · silent beta wipe · Continuity Cut 16+ · tag without ask
CANONICAL OWNER:     release pack · Vite remaster Official Beta face
PROOF BEFORE PUBLISH: maintainer ask · verify:ob4 + remaster foundation · package · CDP title Obscur · ≠ Continuity Pass
```

## 1. Intent

Publish the first **Official Beta** after OB0–OB4 product chrome on remaster ports. Distinct from **foundation** `v2.0.0-beta.10` (R0–R5). Tag only after explicit maintainer ask.

## 2. Preconditions (bar)

| ID | Gate | Required |
|----|------|----------|
| OB0 | Official Beta bar + visual-inherit design | **CLOSED** |
| OB1 | Visual inventory | **CLOSED Pass** |
| OB2 | AuthDoor + ui-kit + tokens | **CLOSED Pass** |
| OB3 | List / thread / composer chrome | **CLOSED Pass** |
| OB4 | Product doors · no Matrix lab chip · title Obscur · CDP spot | **CLOSED Pass** |

**Official Beta Pass** = OB0–OB4. **Published Official Beta** = this cut after ask.

## 3. Proposed cut identity

| Field | Value |
|-------|-------|
| Suggested tag | `v2.0.0-beta.11` |
| Channel | beta |
| Face | Vite `apps/desktop-ui` inside Tauri |
| Predecessor | `v2.0.0-beta.10` (foundation only — keep downloadable unless wipe asked) |
| Package tree | `2.0.0` (unchanged until cut bumps `version.json` / channel on ask) |

## 4. Cut sequence (when asked)

1. Freeze honesty: Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote · video · live multi-device sync **not claimed**.
2. Promote draft notes → `docs/releases/v2.0.0-beta.11-release.md` (or maintainer-chosen tag).
3. Bump `version.json` `releaseTag` (+ channel notes) to match tag.
4. Local gates green on cut commit:
   - `pnpm -C apps/desktop-ui run verify:ob4`
   - `pnpm verify:remaster-foundation` (or `verify:remaster-r2` + `verify:remaster-r4`)
5. `pnpm desktop:package` → NSIS under `release-assets/windows/`.
6. Optional: `pnpm desktop:package --publish-channel` (signed feed).
7. Packaged CDP spot: title must be **Obscur** (not “desktop-ui lab”) · remaster url `tauri.localhost`.
8. Tag + GitHub prerelease **only** after maintainer confirm.
9. Point website / channel download face at new asset — **no silent wipe** of beta.10 without ask.

## 5. Honesty freeze (must ship in notes + shell)

| Topic | Claim |
|-------|-------|
| Soft L3 Fixed | Not claimed |
| Continuity Pass | Methods available as product door · Pass not claimed |
| Tor Verified | Not claimed |
| Matrix promote | Not claimed (lab chip hidden on product face) |
| Live multi-device sync | Not claimed |
| Video | Not usable |
| beta.10 | Foundation artifact · not Official Beta |

## 6. Forbidden on cut

- Tagging/publishing without explicit ask  
- Marketing Soft L3 Fixed or Continuity Pass because chrome looks finished  
- Silent deletion of published beta.10  
- Importing `@/app/features/*` into desktop-ui as part of the cut  
- Inventing Continuity Cut 16+ as a cut blocker  

## 7. Publish ask (surfaced)

```text
ASK: Publish Official Beta as v2.0.0-beta.11 (or name your tag)?
  Reply with: "publish Official Beta" / "publish v2.0.0-beta.11" to proceed.
  Until then: plan READY · no tag · no channel flip · Soft L3 / Continuity Pass not claimed.
```

## 8. NEXT without publish ask

**Stop.** Official Beta bar green. Wait for maintainer publish phrase above.
