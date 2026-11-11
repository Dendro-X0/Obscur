# Design — Cut 2 Private-trust product face (S1 compose)

**Date:** 2026-11-09  
**Status:** **CLOSED 2.0–2.4** (L1 + lab checklist; desktop L2 operator soaks optional; Soft L3 not claimed)  
**Parents:** [cut1-replacement-authority-design-2026-11-09.md](./cut1-replacement-authority-design-2026-11-09.md) · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md) · F9 NARROW

```text
HANDOFF ATOMIC STEP: Cut 2 CLOSED — next NARROW cut via maintainer charter
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · Vite-as-Cut-2
CANONICAL OWNER:     ProtocolAdaptationLayer + private_dc / T3 / kernel ports as product face
PROOF:               L1 2.1–2.3 · cut2-lab-milestone-checklist · cut2-lab-product-face-soak.mjs
SURFACE:             Tauri desktop primary; browser degraded / Nostr-optional
```

## 1. Why this cut (after Cut 1)

Cut 1 closed **authority** (CRM · messages · outbox · T3 wire · chat-state demotion).  
Product face still contradicts NARROW:

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-DEFAULT-NOSTR** | `readActiveProtocolId` defaults to `"nostr"` | Private-trust primary never becomes the product without Settings gymnastics |
| **K-COMPOSE-RELAY** | Composer chrome still relay-status first | H-dc / T3 honesty buried; looks like Nostr app |
| **K-SEND-FALLBACK** | Pipelines can still land on Nostr when session/home unset | Silent carrier swap ≠ adapter honesty |
| **K-INVITE-NOSTR** | `sendConnectionRequest` throws on `private_dc` | Trust invite still Nostr-only while CRM is kernel |

**Not this cut:** Soft L3 Fixed · Vite UI migrate (Cut UI) · Matrix promote · Continuity live multi-device.

## 2. Goal

On desktop lab / private-trust profiles:

> Compose · send · list · sticky trust UI use **private_dc + T3 + kernel ports** as the **default product face** when an H-dc home session exists. Nostr remains a **selectable module**, not the silent default.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **2.0** | This design **ACK** | **ACK’d** via maintainer `continue` |
| **2.1** | Default protocol: if `hasPrivateDcSession(profile)` on native → active protocol `private_dc` (else keep explicit Nostr/Matrix selection) | **L1 Pass** — `resolveActiveProtocolId` + owner-uniqueness |
| **2.2** | Composer / send honesty: when `private_dc` active, chrome shows H-dc/T3 (not relay quorum as primary); send refuses silent Nostr fallback | **L1 Pass** — chips Private DC · composer H-dc/T3 · sendDmWithRetry refuse |
| **2.3** | Trust invite on private-trust: honest “invite requires Obscur-Nostr module” — no throw that strands UI | **L1 Pass** — policy + SendResult refuse + dialog honesty |
| **2.4** | Lab checklist — desktop L2: unlock → H-dc session → compose send → accepted≠delivered → list from SQLite | **Documented** — [cut2-lab-milestone-checklist](./cut2-lab-milestone-checklist-2026-11-09.md) + `scripts/cut2-lab-product-face-soak.mjs`; **≠ Soft L3 Fixed** |

## 4. Cutover law

```text
1. Prefer private_dc when H-dc session exists (desktop).
2. Explicit Nostr/Matrix selection still wins (user override).
3. No silent fallback to Nostr on send failure when private_dc is active.
4. UI remains thin client of PAL + kernel — not a second backend.
5. Soft L3 scripts must not force Nostr-default to stay green.
```

## 5. Non-goals

- Full Next→Vite migrate (Cut UI — separate charter)  
- Soft L3 contact Pass / dual CDP social matrix  
- Tor Verified · Matrix promote  
- Peer-equal multi-protocol hub day one  
- Replacing Tauri shell chrome  

## 6. Proof plan

| Layer | Cut 2 “done” |
|-------|----------------|
| **L1** | Preference default · composer honesty · no silent Nostr fallback · invite policy |
| **L2** | Desktop: H-dc session → compose T3 send → thread list from SQLite; restart sticky |
| **L3** | Optional dual-profile private-trust soak (**not** Soft L3 contact matrix) |
| **L4** | Packaged optional |

## 7. Risks

- Treating “default private_dc” as Soft L3 Fixed.  
- Auto-selecting private_dc without session → empty send face.  
- Vite migrate sneaking in as “compose polish.”  
- Keeping Nostr default so legacy Soft L3 soaks stay green.

## 8. Open items (non-blocking for 2.0 ACK)

1. Exact copy for invite-when-private_dc (kernel-only vs “switch to Obscur-Nostr”).  
2. Whether browser ever auto-prefers private_dc (lean: **no** — desktop-first).  
3. Whether first-run wizard creates H-dc lab session or Settings-only.

## 9. References

- Cut 1 closed — `specs/backend/cut1-lab-milestone-checklist-2026-11-09.md`  
- Preferences — `apps/pwa/app/features/protocol-adaptation/preferences.ts` (`readActiveProtocolId` → `"nostr"`)  
- Send face — `layer.ts` / `private-trust-t3-send.ts` (Cut 1.4)  
- F9 NARROW — `docs/exploration/feasibility/99-synthesis-decision.md`
