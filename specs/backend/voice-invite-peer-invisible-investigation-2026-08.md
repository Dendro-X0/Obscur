# Investigation — Voice invite A↔B never visible

**Date (UTC):** 2026-08-04  
**Evidence:** Sender shows invite + CALLING + toast “left your device but relays have not confirmed”; recipient never sees invite. Metrics: only `relay.primal.net` ACTIVE TRANSPORT; damus DISCONNECTED.

---

```text
HANDOFF ATOMIC STEP: Voice invite provisional wire + card honesty (user pivots: peer never sees invite)
PAUSED / CANCELLED:  Soft L3 Docker as release · COM-RUN-* · AUTH-SESSION · groups/**
CANONICAL OWNER:     dm-send-pipeline Phase-1/2 · publishToRelays · handleSendVoiceCallInvite
PROOF BEFORE DONE:   L1 dm-send-pipeline · L3 dual-profile invite visible on peer
OUT OF SCOPE:        Claiming public Nostr SLA · Soft L3 Docker Pass · video
```

---

## Symptom

| Side | Observation |
|------|-------------|
| A/B sender | Invite card + ringing; `partialWireDelivery` warning toast |
| Peer | No invite card, no incoming ring |

Provisional-wire UX unblocked **sender** ringing without relay OK — it does **not** put the EVENT into the peer’s REQ stream.

## Root cause (code + evidence)

`dm-send-pipeline` always:

1. **Phase-1** `pool.sendToOpen(EVENT)` — no OK waiter  
2. **Phase-2** `publishToRelays` — registers OK waiter, may send **same** EVENT again  

`dm-controller` **always** passes `onConfirmed`, so every DM hits this dual path.

Classic race: OK for Phase-1 arrives before Phase-2 waiter → Phase-2 times out / fails → `partialWireDelivery` → voice invite treats as provisional ring while **peer never ingested a stored event**.

Voice invites are stricter (await confirmation / provisional) so the failure is user-visible; ordinary text may “feel” fine when Phase-1 happens to land.

## Fix direction

When `onConfirmed` is set: **skip Phase-1 sendToOpen**; single publish path via `publishToRelays` (OK-backed). Keep optimistic UI from the controller.

Optional: keep provisional acceptance only if Phase-2 reports true `partialWireDelivery` after that single path (rare).

See [dm-send-skip-phase1-when-confirmed-design-2026-08.md](./dm-send-skip-phase1-when-confirmed-design-2026-08.md).
