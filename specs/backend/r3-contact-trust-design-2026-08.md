# Design — R3 contact / trust probe

**Date (UTC):** 2026-08-02  
**Investigation:** [r3-contact-trust-investigation-2026-08.md](./r3-contact-trust-investigation-2026-08.md)

---

## Script

`scripts/r3-contact-trust-desktop.mjs` · `pnpm verify:r3-contact-trust`

### Pass

```
pass ⇔ trustA ∧ trustB ∧ sendEvidence ∧ !strangerOrFk
sendEvidence ⇔ liveSendOk ∨ (Soft L3 report today with l3.pass ∧ fAck)
```

Live compose send is preferred; Soft L3 corroboration covers CDP detach / Relays leftover flakiness after R1–R2 soaks. Compose attempt hard-capped (~15s).

Exit `0` Pass · `1` Fail · `2` Blocked.

### Claim

R3 Pass ≠ Soft L3 re-claim ≠ public Nostr SLA. Demo exit (R0–R3) may be asserted when R0–R3 Pass on production-parity.
