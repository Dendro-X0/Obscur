# Design — Offline peer dial honesty + invite thread records

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · offline peer dial warning toast  
**Parents:** ring-before-accept · flaky-relay investigation

```text
HANDOFF ATOMIC STEP: B offline / no live ring — thread still shows call invite cards
PAUSED / CANCELLED: Soft L3 Fixed · Claim presence authoritative · Block all dials to offline peers
CANONICAL OWNER:     main-shell voice dial · voice invite card honesty
PROOF BEFORE DONE:   L1 helper for offline dial notice · wire toast before invite send
SURFACE:             Outgoing dial
```

## Problem

Presence shows peer **OFFLINE**. Host still dials; invite DM is written locally and (if relays deliver) appears later on B as a **thread card** without B having been online to accept. Host sees CALLING dock then timeout → feels like a “call record” for a call that never rang on B.

## Contract (this slice)

1. Before sending a voice/video invite, if peer presence is **offline** (caller passes `peerIsOnline === false`), show a **warning toast** once: invite may not be seen until peer is online; continue with dial (presence is soft, not a hard block).  
2. Pure helper: `shouldWarnOfflinePeerBeforeVoiceInviteDial({ peerIsOnline })`.

## Non-goals

- Suppressing invite message persistence (wire needs the DM)  
- Hard-blocking dial when offline  
- Fixing all multi-relay delivery races (2/3)  

_Last updated: 2026-10-19T12:43:00Z_
