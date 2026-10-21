# Design — Pre-B2B capability polish (PB1 / PB2)

**Date (UTC):** 2026-10-10  
**Status:** Design accepted for sequencing · implement only named slices  
**Roadmap:** [pre-b2b-capability-and-media-roadmap-2026-10.md](../../docs/program/pre-b2b-capability-and-media-roadmap-2026-10.md)  
**Capacity shelf:** [scale-flexible-group-architecture-design-2026-10.md](./scale-flexible-group-architecture-design-2026-10.md) (niche → corp → large discussion; no impl while S2 open)  
**Business lock:** [ROADMAP.md](../../docs/business/ROADMAP.md) S2 · dialects PAUSED

---

```text
NEXT ATOMIC STEP:     PB1-B/C L1 closed · pick next outside M1–M3 while desktop frozen
PAUSED / CANCELLED:   New dialects · conference video · ASE-as-GTM · shell-lag until program end
CANONICAL OWNER:      docs (SOP) · messaging/WebRTC (voice) · website (honesty)
PROOF BEFORE DONE:    Per slice below
SURFACE:              Docs / L1 first while desktop unusable; desktop clearnet (Tor OFF) when T1 demo resumes
```

---

## 1. Goal

Make the **T1 private-trust standup** hitchable: proof pack, deploy path, and live **audio** honesty — without opening multiparty video or dialect work.

## 2. Invariants

| ID | Invariant |
|----|-----------|
| I1 | Clearnet path is the B2B demo path; Tor Stuck must not block group live |
| I2 | No claim of video conferencing until M1 ships |
| I3 | Link safety (PB2) never uploads message bodies; outbound URL check is opt-in and labeled |
| I4 | SOP does not require Obscur-operated SaaS |

## 3. PB1-A — Self T1 proof pack

### Contract

Operator runs cell on own infra (or agreed local relay):

1. Two profiles unlock with local keys  
2. DM text + optional voice note  
3. Small group live (membership already Verified band)  
4. Tor preference **OFF** for the pack  
5. Written limits: Tor Verified INFEASIBLE · video not available · public Nostr optional  

### Artifacts

| Artifact | Path / form |
|----------|-------------|
| Notes | `docs/business/EG-LOG.md` or handoff checkpoint |
| Screenshots | Local only; no secrets |
| Limits sheet | Point to [obscur-v2-known-limitations.md](../../docs/program/obscur-v2-known-limitations.md) + this design I2 |

### Proof

- **L3:** Dual-profile desktop · Tor OFF · DM + group send receive  
- **L4:** Optional — second machine / second day cold unlock  

## 4. PB1-B — Deploy / standup SOP draft

### Contract

Single happy path document covering:

1. Install desktop (Gift `/download` or release)  
2. Rotate/generate operator secrets if self-hosting coordination/relay  
3. Bind client to agreed relay (`ws://` local or operator WSS)  
4. First identity · first DM · first group  
5. Handoff: who holds keys · where data lives · how to revoke device  

### Owners / inputs

- Extend [self-hosted-relay-vps-operator-notes-2026-08.md](../../docs/program/self-hosted-relay-vps-operator-notes-2026-08.md)  
- Flowsint-style checklist pattern: secrets · Host allowlist · HTTPS beyond LAN — **ideas only**, Obscur paths  

### Proof

- **L1:** Doc exists; links from PRODUCTIZATION V3 / H1 “Included”  
- **L3:** Stranger-readable dry-run (maintainer or hitch) completes without Slack  

## 5. PB1-C — 1:1 voice reliability + honesty

### Contract

| Surface | Behavior |
|---------|----------|
| Invite send | Quorum / provisional / failed cards already designed — keep honest |
| Connect | Connected beat or explicit fail; no silent hang |
| Consent | Mic only; copy retains “Video conferencing is not supported” until M1 |
| Logs | Operator-visible reason codes where already present |

### Non-goals

- Camera for calls  
- Group voice rooms  
- New SFU  

### Owners

- Existing voice-call invite / WebRTC path  
- [voice-call-invite-wire-provisional-design-2026-08.md](./voice-call-invite-wire-provisional-design-2026-08.md)  
- [media-device-consent-design-2026-08.md](./media-device-consent-design-2026-08.md)

### Proof

- **L1:** Invite delivery + consent tests green  
- **L3:** Dual-profile: note + call connect **or** failed card (not “sent” + fail toast)  

## 6. PB1-D — Positioning honesty

### Contract

Gift / Settings / demo VO:

- Sovereignty · E2EE · operator infra  
- Tor opt-in, not identity  
- No dark-web / gray-market framing  
- ASE = on-device warnings, not content police  

### Proof

- **L1:** Copy review checklist in EG or website PR  
- **A:** Maintainer accepts presenter sheet  

## 7. PB2 — Opt-in link safety

**Implement design:** [pb2-link-safety-design-2026-10.md](./pb2-link-safety-design-2026-10.md)  
**Slice A (2026-10-13):** L1 policy + URL-only builder green — **network/UI await maintainer accept**.

### Contract

```text
User taps URL in decrypt path
  → if attack-profile or setting enables link_safety
  → confirm dialog: "Check reputation? Query leaves this device to <provider>."
  → fetch reputation (URL only)
  → L1 banner or L2 confirm before open
```

| Allowed | Forbidden |
|---------|-----------|
| URL string outbound | Message body · contact graph · keys |
| User cancel = open blocked or open unchecked (setting) | Silent phone-home |
| Strict attack profile may default-on | Mandatory cloud ASE |

### Candidate providers (catalog only)

From public-apis Anti-Malware class (AbuseIPDB, URLScan, URLhaus, …) — pick one in implement slice; key in Vault if needed. Slice A catalogs **URLHaus** as default label only.

### Proof

- **L1:** Policy unit tests · no body in request builder — **Pass** (2026-10-13)  
- **L3:** Toggle off = no network; toggle on = labeled dialog — after accept + slice B/C  

## 8. Implementation order

1. PB1-A (ops)  
2. PB1-B (docs)  
3. PB1-C (eng harden)  
4. PB1-D (copy)  
5. PB2 only after maintainer accept of outbound checks  

## 9. Out of scope

ASE-2 · M1–M3 video · OSINT enrichers · NIM product code (separate charter) · dialect research  

---

_Last updated: 2026-10-10_
