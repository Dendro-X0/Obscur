# Milestone closeout — Platform rewrite band (2026-11)

**Status:** Checkpoint (band still open for polish)  
**Parent:** [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)

```text
PAUSED / CANCELLED (unchanged): Soft L3 · Tor Verified · Matrix promote · Continuity promote
CLAIM: ordered cuts P0–P7-ish + storage S1–S5 L3 + private_dc L2/CDP landed — not multi-protocol Verified
```

## Landed (this band)

| Cut | Proof |
|-----|--------|
| P0–P1 | Charter + boundary map |
| K1–K8 | PAL send fence · adapter boundary · auth mutation · profile trees · SendConfirmation PAL · Canonical slim · onConfirmed Canonical-only |
| P2 / P2 L3 | Daily-door passphrase primary CDP |
| P2-S S1–S5 | Policy · quarantine persist L3 · preview L3 · export L3 · cross-profile L3 |
| P3 | PAL port freeze |
| P4–P4h | private_dc + HTTP `/v1` + lab L2 + CDP + profile scope + rich listDm* + caps/map leaf |
| P5–P6 | Naming glossary · plane README fences |
| P7–P7c | Obscur-Nostr body leaves: maps · capabilities · display/hints — not full extract |
| C3 | Matrix lab capabilities + rich map — **not promote** |
| Feedback readiness | [platform-public-feedback-release-readiness-2026-11.md](./platform-public-feedback-release-readiness-2026-11.md) |

## Still open / deferred

- Production company-DC operator soak (optional; lab stand-in landed)
- Soft L3 · Tor Verified · Matrix promote — **PAUSED**
- Continuity promote — **PAUSED**
- Further Obscur-Nostr body extract (send/list orchestration) · mass path renames

## Honest product claim

Obscur is a **private-trust reference client** with a frozen PAL hosting Nostr + Matrix lab + Private DC wire. It is **not** a finished multi-protocol SDK and does not claim Tor Verified or Soft L3 Fixed.
