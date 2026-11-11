# Remaster R1 — Path audit (desktop-ui sole remaster face)

**Date:** 2026-11-10  
**Status:** **CLOSED** · R1 Pass · parent [remaster-foundation-closeout-2026-11-10.md](./remaster-foundation-closeout-2026-11-10.md)  
**Claim:** Remaster face = `apps/desktop-ui` · Cut 1 kill-list owners not authoritative on remaster path · **≠ Soft L3 Fixed** · **≠ Continuity Pass**

```text
HANDOFF ATOMIC STEP: R1 remaster path audit
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · Continuity Cut 16+
CANONICAL OWNER:     apps/desktop-ui · @obscur/private-trust-engine · HostEnginePort
PROOF:               this audit + remaster-r1-path.contract.test.ts · ≠ invent Continuity methods
```

## 1. Remaster face

| Surface | Role |
|---------|------|
| `apps/desktop-ui` | **Sole remaster product face** (Cuts 3–6 Vite production) |
| `apps/pwa` | Legacy / archive harness — **not** remaster owner; dual writers there do not gate remaster foundation |
| Tauri `frontendDist` | Vite (Cut 5/6) |

## 2. Cut 1 kill-list vs remaster path

| Kill ID | Remaster path finding | Verdict |
|---------|----------------------|---------|
| **K-CRM** | Conversations from `listRelationshipEdges` via host · no `chat-state-store` / `usePeerTrust` import in desktop-ui | **Pass** |
| **K-MSG-DUR** | Messages via `dm.getThread` host · no IndexedDB `MessageQueue` / `dm_message_queue_v1` in desktop-ui | **Pass** |
| **K-OUTBOX-LS** | T3 send via `sendPrivateTrustT3ViaHost` · no LS outbox | **Pass** |
| **K-SEND-FACE** | Native send `private_dc` only · guard refuses silent Nostr fallback | **Pass** |
| **K-CHATSTATE-AUTH** | Contract forbids chat-state authority imports (Cut 3.3) | **Pass** |
| **K-PROTO-PLAIN** | T3 envelope path through host + home deliver | **Pass** |

## 3. Allowed localStorage on remaster (not dual CRM)

These are **Plane 1–3 residue**, not Soft L3 CRM invent:

- Vite identity record (unlock/create)  
- Private home session URL/bearer  
- Continuity linked devices · M6 report · peer grants · Settings T2  
- Continuity M1 peer-trust **snapshot fields** (`obscur.peer_trust.v1` duplicated — no pwa import)

## 4. Planned feature coverage on remaster face

| Planned | Remaster |
|---------|----------|
| Unlock / create identity | AuthDoor + vite identity |
| Private-trust primary | Protocol chips · private_dc default |
| H-dc / T3 send | native ports |
| Continuity methods NARROW | ContinuityDoor M1–M6 + grants |
| Thin Settings T2 | SettingsDoor |
| Soft L3 Fixed | **Out of foundation bar** (paused) |
| Continuity Pass | **Out of foundation bar** |

## 5. Gaps deferred to R2/R3 (not new Continuity cuts)

- Operator L2 soak create→unlock→home→T3→Continuity export (R2)  
- Any fail found there → subtract/fix only (R3)  
- Remaster honesty + beta cut (R4–R5)

## 6. Proof

```bash
pnpm -C apps/desktop-ui exec vitest run src/remaster-r1-path.contract.test.ts
```
