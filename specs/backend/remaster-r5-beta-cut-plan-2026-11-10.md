# Remaster R5 — beta cut plan (publish on ask)

**Date:** 2026-11-10  
**Status:** **CLOSED Published** · tag **v2.0.0-beta.10** · Full Release [42993627086](https://github.com/Dendro-X0/Obscur/actions/runs/42993627086)  
**Parents:** [remaster-foundation-closeout-2026-11-10.md](./remaster-foundation-closeout-2026-11-10.md) · [remaster-r4-honesty-design-2026-11-10.md](./remaster-r4-honesty-design-2026-11-10.md) · draft notes `docs/releases/remaster-beta-release-notes-draft-2026-11-10.md`

```text
HANDOFF ATOMIC STEP: R5 remaster beta cut plan — Continuity Pass / Soft L3 Fixed not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · silent beta wipe · Continuity Cut 16+
CANONICAL OWNER:     release pack · Vite remaster face
PROOF BEFORE PUBLISH: maintainer ask · local package · honesty surfaces · ≠ Continuity Pass
```

## Preconditions (foundation)

| ID | Gate | Required |
|----|------|----------|
| R0–R1 | Closeout + path audit | Pass |
| R2 | E2E soak `pnpm verify:remaster-r2` | Pass |
| R3 | Gap ACK / patch | Closed (no gap) |
| R4 | Honesty + draft notes | Pass |

**Foundation Pass** = R0–R4. **Remaster published** = this cut after explicit ask.

## Cut sequence (when asked)

1. Freeze honesty: Soft L3 Fixed / Continuity Pass / Tor Verified / Matrix promote / video **not claimed**.
2. Promote draft notes → dated `docs/releases/v2.0.0-beta.<n>-release.md` (or remaster-labeled beta).
3. `pnpm verify:remaster-r2` + `pnpm verify:remaster-r4` green on cut commit.
4. `pnpm desktop:package` → NSIS artifact under `release-assets/windows/`.
5. Optional channel publish: `pnpm desktop:package --publish-channel` (signed feed).
6. Tag + GitHub prerelease only after maintainer confirm.
7. Point website download face at new asset (no silent wipe of prior beta without ask).

## Forbidden on cut

- Inventing Continuity Cut 16+ or Soft L3 Fixed as cut blockers  
- Claiming Continuity Pass because methods landed  
- Silent deletion of published beta artifacts  

## NEXT without publish ask

Stop. Foundation band complete. Wait for maintainer “publish remaster beta”.
