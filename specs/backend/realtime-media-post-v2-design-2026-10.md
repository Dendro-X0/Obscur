# Design — Realtime media after v2 (voice → video → conference)

**Date (UTC):** 2026-10-10  
**Status:** Design shelf · **no M1+ implement** until post-v2 handoff  
**Roadmap:** [pre-b2b-capability-and-media-roadmap-2026-10.md](../../docs/program/pre-b2b-capability-and-media-roadmap-2026-10.md)  
**Priors:** [media-device-consent-design-2026-08.md](./media-device-consent-design-2026-08.md) · [voice-call-invite-wire-provisional-design-2026-08.md](./voice-call-invite-wire-provisional-design-2026-08.md) · demo Segment H honesty

---

```text
NEXT ATOMIC STEP:     None for M1+ — pre-B2B uses PB1-C harden only
PAUSED / CANCELLED:   Conference as S2 blocker · Twilio-as-landlord default
CANONICAL OWNER:      messaging voice-call / WebRTC (M1) · future media-sfu (M3)
PROOF BEFORE DONE:    Per stage L1/L3 below
SURFACE:              Desktop first; mobile later
```

---

## 1. Product honesty (today)

| Capability | Status |
|------------|--------|
| Voice notes | Shipped |
| 1:1 voice call | Shipped (invite + WebRTC audio) |
| 1:1 video | **Not shipped** — consent copy forbids conferencing claim |
| Group voice / video conference | **Not shipped** |

Demo VO must keep: audio today · video later · no fake ship date.

## 2. Architecture principles

| ID | Principle |
|----|-----------|
| P1 | Signaling may use existing encrypted DM / relay path; media is peer or operator SFU |
| P2 | **No** mandatory cloud media landlord (conflicts with T1 wall) |
| P3 | Camera consent is a new purpose code (`video_call`) — today camera = QR only |
| P4 | E2EE: 1:1 can extend DTLS/SRTP; conference needs insertable streams or framed keys — charter before code |
| P5 | Fail closed to voice-note / text when media path dies |

## 3. Stage M1 — DM video (1:1)

### Goal

Same invite lifecycle as voice; add video transceiver + camera consent.

### Contracts

| Item | Spec |
|------|------|
| Call type | Extend wire `voice` → allow `av` / `video` only when both peers advertise capability |
| Consent | `media-device-access`: purpose `video_call`; kind microphone + camera |
| UI | DM header control; dock shows local/remote video; hangup shared with voice |
| Fallback | If camera denied → audio-only call with banner |

### Non-goals

Group rooms · screen share · SFU · recording to Vault (separate charter)

### Proof

- **L1:** Consent purpose + capability negotiation tests  
- **L3:** Dual-profile AV call ≥15s or honest audio fallback  
- **A:** Update Segment H / known-limitations when shipped  

### Implement gate

Handoff atomic step names **M1**; media-device-consent OUT_OF_SCOPE line updated.

**Camera-less path (2026-10-18):** Maintainer may lack a camera for L3 AV demo. Use [m1-video-camera-less-engineering-design-2026-10.md](./m1-video-camera-less-engineering-design-2026-10.md) — **M1-A + M1-B L1 done** (callType · capability · consent · dock · camera fail → voice + banner · recvonly transceiver); M1-L3 waits for a camera or hitch peer.

## 4. Stage M2 — Small-group voice (N≤4)

### Goal

Conference-style **audio** for a community/thread with tiny mesh or selective forwarding **on operator host**.

### Contracts

| Item | Spec |
|------|------|
| Membership | Only accepted group members may join |
| Topology | Mesh N≤4 **or** loopback SFU binary under operator (not Obscur SaaS) |
| Signaling | Group-scoped invite events; rate-limited |
| Abuse | Kick / leave; no silent recording |

### Non-goals

Video rooms · N>4 · webinar mode  

### Proof

- **L3:** 3-profile audio room 60s  
- **L4:** Optional — operator SFU on separate VPS  

### Implement gate

Separate charter: `group-voice-m2-charter` after M1 Verified.

## 5. Stage M3 — Conference video

### Goal

Multiperson video for teams who distrust Zoom-class landlords — **self-hostable** media path.

### Contracts (design-level only)

| Item | Direction |
|------|-----------|
| SFU | Operator-deployed (compose); clients never require Obscur cloud |
| E2EE | Prefer insertable streams / per-participant keys — spike before UI |
| Scale | Start N≤8; document hard cap |
| ASE | Link/device consent; no “safe conference” surveillance |

### Non-goals

PSTN · livestream CDN · gray-market “anonymous rooms” branding  

### Proof

- **L1:** SFU health + join ACL unit tests  
- **L3:** 4-profile video 5 min on operator host  
- **A:** Threat-model one-pager for hitch  

### Implement gate

Maintainer charter + NIM/media owner named; not before M2.

## 6. Relationship to pre-B2B

| Now | Later |
|-----|-------|
| PB1-C harden 1:1 **audio** | M1 video |
| Keep “no video” copy | Flip copy only after M1 V |

Do **not** schedule M1 as a condition for first B2B outreach.

## 7. Risks

| Risk | Mitigation |
|------|------------|
| NAT / relay flakiness | Honest fail + voice-note fallback (already demo guidance) |
| E2EE theater on SFU | No “E2EE conference” claim until P4 spike passes |
| Scope explosion vs Zoom | Cap N; team cell use-case only |
| Dialect pause | Media stages use existing transport; no new dialect |

## 8. Out of scope

Implementing M1–M3 in this doc · replacing voice notes · Tor-required media  

---

_Last updated: 2026-10-10_
