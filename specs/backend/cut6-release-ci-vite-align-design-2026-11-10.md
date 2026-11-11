# Design — Cut 6 release / CI Vite align

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **6.0–6.4 L1 + checklist** · Soft L3 still paused  
**Parents:** [cut5-vite-production-cutover-design-2026-11-10.md](./cut5-vite-production-cutover-design-2026-11-10.md) · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md) · F9 NARROW

```text
HANDOFF ATOMIC STEP: Cut 6 CLOSED (6.0–6.4 L1 + checklist) — Soft L3 still paused
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     apps/desktop packaging · .github workflows · desktop-ui production face
PROOF BEFORE DONE:   per-slice L1; optional packaged L4; ≠ Soft L3
SURFACE:             Desktop Vite default · mobile/PWA shell stays Next-path until named cut
ACK 6.0:             2026-11-10 — proceed 6.1 (Cut 5 left Android CI asserting Next beforeBuild)
```

## 1. Why this cut (after Cut 5)

Cut 5 flipped committed desktop `frontendDist` to Vite. Residue:

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-CI-NEXT-GREP** | `build-android.yml` greps `pnpm run build:pwa-shell` in `tauri.conf.json` | CI fails after honest desktop flip |
| **K-MOBILE-DIST** | Android/iOS still need PWA static shell; committed conf now Vite | Mobile packages wrong/empty `desktop-ui/dist` when `SKIP_TAURI_BEFORE_BUILD=1` |
| **K-PACKAGE-COPY** | `package-desktop-local` / channel docs still say “PWA shell” as desktop default | Operator confusion; silent Next assumption |
| **K-RELEASE-FACE** | Web artifact job still builds `apps/pwa/out` (ok as rollback/web) without naming Vite desktop | Dual faces without law |

**Not this cut:** Soft L3 Fixed · Continuity / F-sync · Tor Verified · Matrix promote · deleting `apps/pwa` · porting full Next Settings into Vite · claiming packaged NSIS Pass without L4.

## 2. Goal

1. **Desktop** packaging/CI honor committed Vite `frontendDist`.  
2. **Mobile** keeps an explicit PWA/`pwa/out` overlay (no silent wipe of mobile shell).  
3. CI gates assert the **new** law (Vite desktop · Next/mobile rollback), not the pre-5.3 law.  
4. Soft L3 / Continuity / Tor / Matrix stay **paused**.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **6.0** | This design **ACK** | Maintainer/continue ACK · **DONE 2026-11-10** |
| **6.1** | Mobile overlay + Android CI/script wiring; stop asserting Next in committed desktop conf | L1 · **DONE** (`tauri.mobile.conf.json` · `verify:cut6-1`) |
| **6.2** | Desktop package/release copy + optional release.yml honesty (Vite beforeBuild; web-pwa = rollback/web) | L1 · **DONE** (`package-desktop-local` · channel README · `verify:cut6-2`) |
| **6.3** | Channel / download-face note (Vite desktop default; Next rollback named) | L1 · **DONE** (`verify:cut6-3`) |
| **6.4** | Lab checklist — optional packaged L4 Vite NSIS; mobile smoke optional | Soak doc · **DONE** (`verify:cut6-4`) · **≠ Soft L3** |

## 4. Cutover law

```text
1. Desktop committed tauri.conf.json stays Vite (Cut 5).
2. Mobile/Android must pass an explicit PWA overlay (tauri.mobile.conf.json) — never assume committed dist.
3. apps/pwa remains alive (rollback + mobile shell + web artifact).
4. Soft L3 / Continuity / Tor / Matrix promote stay out of band.
5. Packaged NSIS Vite Pass is optional L4 — not required to close 6.1–6.3 L1.
```

## 5. Non-goals

- Soft L3 contact Pass / dual CDP  
- Continuity sealed snapshot / F-sync enroll  
- Tor Verified · Matrix promote  
- Vite-as-mobile shell (later cut if chartered)  
- Silent beta wipe · unscoped mega-delete  

## 6. Proof plan

| Layer | Cut 6 “done” |
|-------|----------------|
| **L1** | CI/mobile overlay contracts · package/release copy · channel honesty |
| **L2** | Optional desktop package smoke with Vite dist |
| **L3** | Optional dual-profile on packaged Vite (**not** Soft L3 matrix) |
| **L4** | Optional packaged NSIS with Vite asset |

## 7. Risks

- Android CI still packaging Vite dist → blank mobile shell.  
- Re-introducing Next as desktop default via “temporary” CI greps.  
- Claiming Continuity or Soft L3 from a green release workflow.  

## 8. References

- Cut 5 CLOSED — `cut5-vite-production-cutover-design-2026-11-10.md`  
- Next rollback — `apps/desktop/src-tauri/tauri.next.rollback.conf.json`  
- F-sync (paused) — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md` · **not** Cut 6  
