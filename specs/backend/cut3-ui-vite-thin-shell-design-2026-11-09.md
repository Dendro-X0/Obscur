# Design — Cut 3 Cut UI (Vite thin shell)

**Date:** 2026-11-09  
**Status:** **CLOSED 3.0–3.5** (L1 + lab checklist; desktop L2 operator soaks optional; Soft L3 not claimed)  
**Parents:** [cut2-private-trust-product-face-design-2026-11-09.md](./cut2-private-trust-product-face-design-2026-11-09.md) · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md) · F9 NARROW

```text
HANDOFF ATOMIC STEP: Cut 3 CLOSED — next NARROW cut via maintainer charter
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     apps/desktop-ui (Vite lab) → ProtocolAdaptationLayer + kernel ports (thin client)
PROOF:               L1 3.1–3.4 · cut3-lab-milestone-checklist · cut3-lab-vite-shell-soak.mjs
SURFACE:             Tauri desktop primary; Next.js shell kept until cutover; browser degraded
```

## 1. Why this cut (after Cut 1–2)

Cut 1 closed **authority**. Cut 2 closed **private-trust product face** on the existing Next shell.  
Rewrite law still unmet:

> UI is a **thin client of kernel ports** — not a second backend.  
> Cut UI (Vite) remains after authority cutover.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-NEXT-MONOLITH** | Product face lives in Next App Router mega-tree | Couples routing/SSR to desktop shell; slows replacement |
| **K-UI-AS-BACKEND** | Large providers still hydrate/mutate as if UI owns durability | Contradicts Cut 1 owners even when gated |
| **K-DUAL-ENTRY** | No first-class Vite/Tauri webview entry for private-trust lab | Lab soaks stay tied to Next cold paths |
| **K-SHELL-INVENT** | Feature modules that invent `profileId` / touch PDK from React | Undoes Cut 0.2–0.3 fences |

**Not this cut:** Soft L3 Fixed · Continuity / F-sync live multi-device · Tor Verified · Matrix promote · mass-delete `apps/pwa` day one · silent beta wipe.

## 2. Goal

Ship a **NARROW Vite lab shell** that:

1. Unlocks via existing auth-kernel / PDK door (no parallel unlock).  
2. Renders private-trust compose face (Cut 2) against PAL + kernel only.  
3. Becomes the **preferred Tauri webview entry** for private-trust lab soaks.  
4. Leaves Next shell **alive** until explicit cutover — strangler of *entry*, not overnight rewrite.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **3.0** | This design **ACK** | **ACK** in handoff (continue = ACK) |
| **3.1** | Vite app scaffold `apps/desktop-ui` + Tauri lab `devUrl` toggle | **L1 Pass** — `vite build`; `cut3-no-pdk-invent.contract` |
| **3.2** | Auth door on Vite — shared `resolveAuthShellReady` + `DeviceUnlockPort` | **L1 Pass** — unlock→shell-ready; AuthGateway uses same gate |
| **3.3** | Private-trust home: Protocols + composer + DM list via injected PAL/kernel ports | **L1 Pass** — import boundary; shared compose-face; silent-Nostr refuse |
| **3.4** | Quarantine dual-entry: Next vs Vite; lab default → Vite when flag on | **L1 Pass** — cut3-dual-entry · production `pwa/out` intact |
| **3.5** | Lab checklist — desktop L2 on Vite entry; **≠ Soft L3 Fixed** | **Documented** + `cut3-lab-vite-shell-soak.mjs` Pass |

## 4. Cutover law

```text
1. New Vite entry first (lab flag) — Next remains production beta until 3.4–3.5.
2. Reuse Cut 0–2 ports; do not reintroduce LS/IDB/chat-state authority.
3. No parallel auth/PDK owners in the Vite tree.
4. Delete/quarantine only after Vite lab L2 green — not mega-PR day one.
5. Continuity (F-sync) stays Plane 3 — out of scope.
```

## 5. Non-goals

- Full Next→Vite file-for-file port of groups/voice/Matrix lab  
- Soft L3 contact Pass / dual CDP social matrix  
- Continuity sealed snapshot / multi-device enroll (F-sync)  
- Tor Verified · Matrix promote  
- OAuth-as-root · deleting quarantine/profile isolation  

## 6. Proof plan

| Layer | Cut 3 “done” |
|-------|----------------|
| **L1** | Vite build · auth door contract · PAL/kernel import boundary · no PDK invent |
| **L2** | Desktop: Vite entry unlock → H-dc session → T3 compose send → SQLite list |
| **L3** | Optional dual-profile on Vite entry (**not** Soft L3 contact matrix) |
| **L4** | Packaged NSIS with Vite asset — optional later |

## 7. Risks

- Treating Vite scaffold as “rewrite finished.”  
- Porting MessagingProvider wholesale (reimports dual owners).  
- Continuity sneaking in because F-sync doc is open in the IDE.  
- Switching Tauri production `frontendDist` before lab L2.  

## 8. Open items

1. Package path: **`apps/desktop-ui`** (chosen in 3.1).  
2. Router: lean thin — no router until 3.2/3.3 needs it.  
3. When Next becomes lab-only vs removed (after 3.5).  

## 9. Operator entry

```bash
# Cut 3.4 lab runner — defaults to Vite (quarantined; no beta wipe):
pnpm dev:desktop:lab

# Opt back to Next webview in lab context:
OBSCUR_DESKTOP_LAB_ENTRY=next pnpm dev:desktop:lab

# Direct Vite overlay:
pnpm -C apps/desktop dev:vite-lab
```

Production / beta path remains `apps/pwa/out` via default `tauri.conf.json`.  
Dual-entry matrix: [cut3-dual-entry-quarantine-2026-11-09.md](./cut3-dual-entry-quarantine-2026-11-09.md).

## 10. References

- Cut 2 closed — `specs/backend/cut2-lab-milestone-checklist-2026-11-09.md`  
- Dual-entry — `specs/backend/cut3-dual-entry-quarantine-2026-11-09.md`  
- Lab checklist — `specs/backend/cut3-lab-milestone-checklist-2026-11-09.md`  
- Posture — `specs/backend/rewrite-replacement-posture-2026-11-09.md` §4–5  
- F-sync (paused Continuity) — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md` · **not** Cut 3  
- SUPERSEDE keep-rules — usable Tauri shell · no silent beta wipe  



