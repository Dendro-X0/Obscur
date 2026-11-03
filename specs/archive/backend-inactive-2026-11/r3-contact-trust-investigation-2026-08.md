# Investigation — R3 contact / trust (accepted peer compose)

**Date (UTC):** 2026-08-02  
**Handoff:** R3 · Contact / trust  
**Parent:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md)  
**Prior:** Soft L3 Pass (mutual send) · R2 dial Pass

---

## Session header

```text
NEXT ATOMIC STEP:     R3 · Contact / trust
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION
CANONICAL OWNER:      obscur.peer_trust.v1.* · compose / stranger gate
PROOF BEFORE DONE:    Dual CDP · mutual acceptedPeers · compose · send without stranger/FK
OUT OF SCOPE:         Public Nostr SLA · Soft L3 re-claim · COM-RUN
```

---

## Pass contract

| Check | Pass |
|-------|------|
| Mutual trust | A has B in `acceptedPeers` and B has A (seed if missing — product accept path may already exist from Soft L3) |
| Compose | Tester1 opens Tester2 thread with visible compose |
| Send | Marker sent locally visible; no `stranger` / `FOREIGN KEY` / compose-disabled Fail |
| Evidence | JSON report `r3.pass` |

Soft L3 already proved mutual DM; R3 is the **named** contact/trust claim without re-running full Soft L3 path honesty.

---

## Fix direction

Agent script `verify:r3-contact-trust` — dual CDP, body-shell attach, seed/verify peer_trust, open compose, send `R3-TRUST-*` marker.

**No product change** unless Fail with stranger/FK evidence.
