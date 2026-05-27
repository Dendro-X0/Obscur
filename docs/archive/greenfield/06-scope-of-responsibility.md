# Scope of responsibility & limited user protection

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19  
**Normative for:** Charter, public copy, Phase 5 safety page

---

## What we are responsible for

We are responsible **only** for:

| Scope | Includes |
|-------|----------|
| **Our client software** | Crypto implementation, local storage, warning engine, UI honesty, updates we ship |
| **Our reference courier** (if we ship one) | Contract behavior, no plaintext storage, documented metadata |
| **Our specifications** | Charter, phases, tests — delivery per [01-phase-roadmap.md](./01-phase-roadmap.md) |
| **Our designs** | Architecture in [04-architecture-sketch.md](./04-architecture-sketch.md) implemented without covert enforcement |

We complete the project by **meeting phase exit gates**, not by solving all societal harms of online communication.

---

## What we are not responsible for

| Out of scope | Why |
|--------------|-----|
| Third-party relays, Nostr relays, other clients | Not our code; adapters are best-effort |
| User device OS malware or physical coercion | Endpoint security is user/environment |
| Off-platform payments (Wire, cash, other apps) | No in-app finance; warnings are conversational only |
| User decisions after a warning | Recipient sovereignty — we do not decide for them |
| Illegal acts by users | We do not monitor or censor content; we do not law-enforce |
| Guarantees against all bots, scams, or impersonation | Economics reduce scale; cannot eliminate |
| Other people’s forks or misconfigured self-hosts | Operators own their deployment |
| App store policies, regional law compliance | Document honestly; seek counsel when shipping |

---

## Limited protection (explicit product promise ceiling)

The product **helps** legitimate users by:

- E2EE for message bodies on infrastructure we design ([05-security-data-classes.md](./05-security-data-classes.md)).
- Behavioral **recipient** warnings with transparent rule packs ([02-warning-and-trust-model.md](./02-warning-and-trust-model.md)).
- User-controlled block, leave, mute, trust settings.
- Anti-abuse friction (rates, invites, optional WoT).

The product **does not** guarantee:

- Safety from ignoring warnings or trusting scammers.
- Recovery of funds sent off-platform.
- Removal of messages from other users’ devices or third-party relays.
- Perfect anonymity against global passive adversaries.
- Replacement for law enforcement, banks, or professional fraud investigation.

**Copy standard:** Use “helps,” “reduces risk,” “informs” — never “ensures,” “guarantees,” or “prevents all.”

---

## Program completion definition

Success = **specifications implemented and phase gates passed**, not:

- Viral adoption,
- Regulatory approval worldwide,
- Elimination of online fraud category-wide.

| Milestone | Done when |
|-----------|-----------|
| Phase N | All N acceptance tests green on two devices (+ security tests where listed) |
| Program v1 | Phase 5 exit gate + published privacy/safety pages aligned with this doc |
| Maintenance | Critical vulnerabilities in **our** code addressed per policy TBD |

Stopping or archiving after failed kill criteria (see roadmap) is a **valid completed outcome** — not personal failure.

---

## Relation to “digital scorched earth”

Scorched earth applies to **our infrastructure’s copy of user content** (classes B worthless without A).

It does **not** mean we promise users are invisible in the real world, or that all metadata vanishes. We document **C/D** exposure honestly on the privacy nutrition label (Phase 5).

---

## Engineering discipline

1. **Ship per phase** — no scope creep into finance, global moderation, or server-side chat search.
2. **One owner per fact** — avoid Obscur-style parallel truth paths.
3. **Tests before bands** — security tests S-1…S-5 where applicable.
4. **Honest docs** — if a feature needs class C/D, classify it in the spec before coding.

---

## Public-facing summary (for website / store)

> This app encrypts your messages so our servers cannot read them. It can warn **you** about suspicious patterns; **you** choose whom to trust or block. It cannot stop scams outside the app, recover money you send elsewhere, or control other people’s software. We are responsible for this app’s code — not for the entire internet.
