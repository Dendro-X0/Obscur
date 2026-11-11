# Design — Cut 4 Vite native port wire

**Date:** 2026-11-09  
**Status:** **ACK 4.0** (2026-11-10) · **Cut 4 CLOSED (4.0–4.4)** · Soft L3 paused  
**Parents:** [cut3-ui-vite-thin-shell-design-2026-11-09.md](./cut3-ui-vite-thin-shell-design-2026-11-09.md) · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md) · F9 NARROW

```text
HANDOFF ATOMIC STEP: Cut 4 CLOSED — next NARROW via maintainer (Soft L3 still paused)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     apps/desktop-ui adapters → @dweb/auth DeviceUnlockPort · HostEnginePort · private-trust T3
PROOF BEFORE DONE:   per-slice L1; desktop L2 unlock→T3 send→SQLite list on Vite entry (≠ Soft L3)
SURFACE:             Tauri Vite lab primary for soaks; Next beta production frontendDist unchanged
ACK 4.0:             2026-11-10 — proceed 4.1 DeviceUnlock without apps/pwa mega-import
```

## 1. Why this cut (after Cut 3)

Cut 3 closed the **Vite lab shell** (entry · auth door · private-trust home · dual-entry quarantine).  
Residue: the shell still talks to **lab stubs**, not the keepable kernel:

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-LAB-UNLOCK** | `createLabDeviceUnlockPort` accepts a hardcoded passphrase | No PDK / SQLite / auth-kernel face — cannot claim unlock→shell-ready on product path |
| **K-LAB-HOME** | In-memory `createLabPrivateTrustHomePorts` | No `relationship_edge` / SQLite / T3 home ACK — contradicts Cut 0–1 owners |
| **K-PWA-MEGA-IMPORT** | Temptation to `import` AuthGateway / PAL from `apps/pwa` | Reimports Next/chat-state dual owners; undoes K-SHELL-INVENT fence |
| **K-VITE-L2-GAP** | Cut 3.5 L2 checklist blocked on “optional native wire” | Lab soaks stay cosmetic without HostEnginePort + H-dc |

**Not this cut:** Soft L3 Fixed · Continuity / F-sync · Tor Verified · Matrix promote · flipping production `frontendDist` · mass-delete Next · Soft L3 dual CDP.

## 2. Goal

Ship **NARROW native adapters** for the Vite lab shell that:

1. Unlock via the same `DeviceUnlockPort` contract as auth-kernel (PDK path; no parallel opener).  
2. List conversations/messages via `HostEnginePort` / dm-engine (SQLite), not chat-state.  
3. Send private-trust via `prepareT3Outbound` → H-dc envelope → `completeT3HomeAck` (accepted ≠ delivered).  
4. Keep lab stubs available behind an explicit fallback flag for headless CI without Tauri.  
5. Leave Next production beta **untouched**.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **4.0** | This design **ACK** | Maintainer ACK in handoff · **DONE 2026-11-10** |
| **4.1** | Package-facing unlock adapter for Vite — thin Tauri/auth-kernel bridge **without** importing AuthGateway / MessagingProvider | L1: contract forbids `apps/pwa` feature imports; DeviceUnlockPort shape · **DONE** (`@obscur/auth-engine` delegating port · desktop-ui resolve + fail-closed native · `verify:cut4-1`) |
| **4.2** | Native `PrivateTrustHomePorts`: resolve protocol (shared evidence) · list via HostEnginePort · send via private-trust T3 helpers | L1: unit/contract with injected HostEnginePort; silent-Nostr refuse retained · **DONE** (`sendPrivateTrustT3ViaHost` · edge/dm list helpers · `createNativePrivateTrustHomePorts` · `verify:cut4-2`) |
| **4.3** | Wire `App` / AuthDoor to prefer native adapters when Tauri host available; lab stubs only when `OBSCUR_DESKTOP_UI_LAB_STUBS=1` or host absent | L1: selection contract · **DONE** (shared `resolveDesktopUiAdapterSource` · App wires unlock+home · fail-closed unlock/home deliver until 4.4 · `verify:cut4-3`) |
| **4.4** | Lab checklist — desktop L2 on Vite: unlock → H-dc session → T3 send → SQLite list; **≠ Soft L3 Fixed** | Soak doc/script · **DONE** (passphrase handlers · sessioned H-dc deliver · `cut4-lab-milestone-checklist` · `cut4-lab-vite-native-soak.mjs`) |

## 4. Cutover law

```text
1. Prefer extracting/adapting ports into packages (@dweb/auth, @obscur/engine-host, @obscur/private-trust-engine, @obscur/dm-engine).
2. Do not import apps/pwa feature trees into apps/desktop-ui.
3. Lab stubs remain for CI; product soak path is native when Tauri + PDK available.
4. Production frontendDist stays ../../pwa/out until a later cutover charter.
5. Continuity (F-sync) and Soft L3 stay paused — out of scope.
```

## 5. Non-goals

- Porting full AuthScreen / profile picker / groups / voice into Vite  
- Soft L3 contact Pass / dual CDP  
- Continuity sealed snapshot / multi-device enroll  
- Tor Verified · Matrix promote  
- Silent beta wipe · deleting Next day one  

## 6. Proof plan

| Layer | Cut 4 “done” |
|-------|----------------|
| **L1** | Adapter contracts · no pwa mega-import · HostEnginePort inject · T3 send unit · stub selection |
| **L2** | Desktop Vite entry: PDK unlock → shell-ready → H-dc T3 send → SQLite list |
| **L3** | Optional dual-profile on Vite (**not** Soft L3 matrix) |
| **L4** | Packaged NSIS Vite asset — still later / optional |

## 7. Risks

- Pulling `auth-kernel-device-unlock-adapter` via path alias → Next dependency graph.  
- Calling `open_database` / `activateNativeStorageAtRestUnlock` from Vite UI (K-SHELL-INVENT).  
- Claiming Soft L3 or Continuity from a successful T3 lab send.  
- Flipping production `frontendDist` “because Vite L2 passed.”  

## 8. Open items

1. ~~How much of unlock can live in `@obscur/auth-engine` vs thin Tauri invoke facade.~~ → **4.1:** `createDelegatingDeviceUnlockPort` in package; Vite handlers injectable; PDK/Tauri commands = later slice.  
2. Whether protocol preference storage for Vite reuses scoped LS keys or a kernel preference port.  
3. When Next becomes lab-only (post Cut 4 L2 + cutover charter).  

## 9. References

- Cut 3 closed — `specs/backend/cut3-lab-milestone-checklist-2026-11-09.md`  
- Dual-entry — `specs/backend/cut3-dual-entry-quarantine-2026-11-09.md`  
- T3 send face — `apps/pwa/.../private-trust-t3-send.ts` (extract target, not import target)  
- DeviceUnlockPort — `@dweb/auth/ports/device-unlock-port`  
- F-sync (paused) — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md` · **not** Cut 4  
