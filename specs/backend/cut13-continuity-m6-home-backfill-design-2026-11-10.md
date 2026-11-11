# Design — Cut 13 Continuity M6 private-home backfill (F-sync C4 NARROW)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **13.0–13.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** [20-cross-device-profile-sync-e2ee.md](../../docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md) · Cuts 7–12 · [continuity-pioneering-design-2026-11.md](./continuity-pioneering-design-2026-11.md)

```text
HANDOFF ATOMIC STEP: Cut 13 Continuity M6 private-home backfill (user continue after Cut 12 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · live delta sync
CANONICAL OWNER:     Continuity Plane 3 · M6 home backfill · ContinuityDoor
PROOF BEFORE DONE:   per-slice L1; ≠ Continuity Pass · ≠ Soft L3 · ≠ invent CRM from chat
SURFACE:             list home conversations + opaque envelopes since cursor · backfill report
ACK 13.0:            2026-11-10 — proceed 13.1 (user continue; Soft L3 stays paused)
CLOSEOUT:            2026-11-10 — verify:cut13-5 Pass · Continuity Pass not claimed
```

## 1. Why this cut

F-sync C0–C3 NARROW landed (M1–M5 registry). C4 starts with **M6 peer/DC backfill**. After identity restore, entitled history on the private home is still unreachable from ContinuityDoor — operators only have sealed M1/M2 restore, not living-graph pull of opaque envelopes.

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-NO-HOME-BACKFILL** | Continuity restores SCU only | F-sync M6 / living-graph gap |
| **K-PLAINTEXT-TRAP** | Temptation to treat `/messages` body as CRM | Soft L3 invent / plaintext home trap |
| **K-PASS-CLAIM** | Backfill ≠ Continuity Pass bait | Must stay NARROW + honest |

**Not this cut:** Continuity Pass · Soft L3 Fixed · live M5 delta fan-out · peer history grants UI · Tor Verified · Matrix promote · decrypt-into-CRM.

## 2. Goal

1. **List** private-home conversations + **pull opaque envelopes** (`envelope` required; plaintext rows dropped).  
2. **Cursor + report** in local Continuity residue (counts · dropped plaintext · cursorUnixMs).  
3. **Port + ContinuityDoor** — `backfillFromPrivateHome`.  
4. Honest copy: M6 ≠ Continuity Pass · ≠ Soft L3 CRM invent · Soft L3 paused.

## 3. Deliver

| Slice | Deliver | Proof |
|-------|---------|-------|
| **13.0** | Design ACK | continue ACK · **DONE 2026-11-10** |
| **13.1** | Home client list conversations + envelopes | L1 · **DONE** (`verify:cut13-1`) |
| **13.2** | M6 backfill report module + storage | L1 · **DONE** (`verify:cut13-2`) |
| **13.3** | ContinuityPorts `backfillFromPrivateHome` | L1 · **DONE** (`verify:cut13-3`) |
| **13.4** | ContinuityDoor M6 UI | L1 · **DONE** (`verify:cut13-4`) |
| **13.5** | Lab checklist · **≠ Continuity Pass** | Soak · **DONE** (`verify:cut13-5`) |

## 4. Law

```text
1. Opaque envelopes only — rows without envelope are dropped (counted, not imported as CRM).
2. Backfill does not invent relationship_edge / Soft L3 trust from message bodies.
3. Live multi-device delta sync remains out of scope — ≠ Continuity Pass.
4. Soft L3 / Tor / Matrix stay paused.
5. No apps/pwa mega-import — mirror list helpers in private-trust-engine home client.
```

## 5. Non-goals

- Continuity Pass  
- Soft L3 Fixed  
- Peer-to-peer history grant UX (Ingredient 5 — later)  
- Live encrypted delta fan-out  
- Decrypting envelopes into chat-state as product claim  

## 6. Proof

| Layer | Done |
|-------|------|
| **L1** | Home list + backfill report + ports + door contracts · **Pass** (`pnpm verify:cut13-5`) |
| **L2+** | Optional dual-device home soak |

## 7. References

- F-sync C4 — `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- Cut 0.6 H-dc — listEnvelopes?since · plaintext dropped  
- Cut 9 M2 — private home Continuity backups  
