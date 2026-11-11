# Design — Cut 5 Vite production cutover

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **5.0–5.4 L1 + checklist** · Soft L3 still paused  
**Parents:** [cut4-vite-native-port-wire-design-2026-11-09.md](./cut4-vite-native-port-wire-design-2026-11-09.md) · [cut3-dual-entry-quarantine-2026-11-09.md](./cut3-dual-entry-quarantine-2026-11-09.md) · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md) · F9 NARROW

```text
HANDOFF ATOMIC STEP: Cut 5 CLOSED (5.0–5.4 L1 + checklist) — Soft L3 still paused
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     apps/desktop Tauri entry · apps/desktop-ui production face · apps/pwa lab/beta quarantine
PROOF BEFORE DONE:   per-slice L1; desktop L2 Vite as default webview; packaged L4 optional; ≠ Soft L3
SURFACE:             Tauri desktop primary; Vite becomes default frontendDist; Next kept as rollback/lab
ACK 5.0:             2026-11-10 — proceed 5.1 readiness/rollback gate (no committed dist flip yet)
```

## 1. Why this cut (after Cut 4)

Cuts 3–4 landed a **Vite lab shell** with native DeviceUnlock + HostEnginePort/T3 adapters.  
Residue: production still points at Next, so the rewrite product face is not the shipped desktop face.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-NEXT-DEFAULT** | `tauri.conf.json` `frontendDist=../../pwa/out` | Dual product faces; Vite L2 never becomes the beta users touch |
| **K-LAB-ONLY-VITE** | Vite only via `dev:desktop:lab` / overlay | Operators treat rewrite UI as optional theater |
| **K-SILENT-FLIP-RISK** | Temptation to flip dist without rollback | Violates SUPERSEDE keep-rules (no silent beta wipe) |
| **K-NEXT-ORPHAN** | No explicit Next quarantine role after flip | Beta confusion; Soft L3 soaks still on Next without a named home |

**Not this cut:** Soft L3 Fixed · Continuity / F-sync · Tor Verified · Matrix promote · deleting `apps/pwa` · mass-delete Next day one · claiming packaged NSIS Pass without L4 soak.

## 2. Goal

Ship a **NARROW, reversible** cutover so:

1. Tauri **default** webview loads Vite (`apps/desktop-ui`) for desktop product.  
2. Next (`apps/pwa`) remains **alive** as rollback + optional lab entry (not silent wipe).  
3. Cutover is gated by readiness contracts + explicit env/flag — never an accidental `build` side effect.  
4. Soft L3 / Continuity / Tor / Matrix promote stay **paused** and are not implied by a green Vite default.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **5.0** | This design **ACK** | Maintainer ACK in handoff · **DONE 2026-11-10** |
| **5.1** | Cutover readiness gate — checklist + L1 contracts that production scripts still have a **documented rollback** path to Next | L1: contract forbids deleting Next dist path; rollback env documented · **DONE** (`obscur-desktop-production-entry` · `verify:cut5-1`) |
| **5.2** | Opt-in default: `OBSCUR_DESKTOP_UI_AS_DEFAULT=1` (or equivalent) makes Vite the Tauri frontend for `dev`/`build` without editing committed `tauri.conf.json` yet | L1: wire recipes to resolver · **DONE** (`run-desktop-production.mjs` · `dev`/`build` · `verify:cut5-2`) |
| **5.3** | Commit flip: `tauri.conf.json` `frontendDist` → `../../desktop-ui/dist`; Next overlay becomes lab/rollback config | L1: dual-entry contracts updated · **DONE** (`tauri.next.rollback.conf.json` · `verify:cut5-3`) |
| **5.4** | Lab checklist — desktop L2 Vite-as-default unlock→home; optional packaged L4; Next rollback soak | Soak doc/script · **DONE** (`cut5-lab-milestone-checklist` · `verify:cut5-4`) · **≠ Soft L3 Fixed** |

## 4. Cutover law

```text
1. Never delete apps/pwa or published beta artifacts as the cutover step.
2. Rollback must remain one flag/config away (Next overlay or OBSCUR_DESKTOP_LAB_ENTRY=next).
3. Flip committed frontendDist only in slice 5.3 after 5.1–5.2 L1 green.
4. Soft L3 / Continuity / Tor / Matrix promote stay out of band.
5. Packaged NSIS Vite Pass is optional L4 — not required to close 5.1–5.3 L1.
```

## 5. Non-goals

- Soft L3 contact Pass / dual CDP  
- Continuity sealed snapshot / multi-device enroll (F-sync)  
- Tor Verified · Matrix promote  
- Porting full Next Settings / groups / voice into Vite in this cut  
- Silent beta wipe · unscoped mega-delete  

## 6. Proof plan

| Layer | Cut 5 “done” |
|-------|----------------|
| **L1** | Readiness/rollback contracts · opt-in resolver · committed dist flip contracts |
| **L2** | Desktop default Vite: unlock → private-trust home → T3 send path |
| **L3** | Optional dual-profile on Vite default (**not** Soft L3 matrix) |
| **L4** | Optional packaged NSIS with Vite asset |

## 7. Risks

- Flipping `frontendDist` before operator Cut 4 L2 (identity + H-dc session) → empty/broken beta.  
- Soft L3 soaks still targeting Next `:3340` without updating soak docs.  
- Claiming Continuity or Soft L3 from a successful Vite default soak.  
- Deleting Next “because Vite is default.”  

## 8. Open items (non-blocking for 5.0 ACK)

1. Whether published download face / CI release matrix updates in 5.3 or a follow-on release cut.  
2. How long Next remains rollback-primary vs lab-only after 5.3.  
3. Whether Continuity / Soft L3 resume gets a **separate** charter after cutover (not this cut).  

## 9. References

- Cut 4 CLOSED — `specs/backend/cut4-lab-milestone-checklist-2026-11-09.md`  
- Dual-entry — `specs/backend/cut3-dual-entry-quarantine-2026-11-09.md`  
- F-sync (paused) — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md` · **not** Cut 5  
- Soft L3 — remains paused (B4) · **not** Cut 5  
