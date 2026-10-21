# Investigation — Realtime call performance · stability · UI/UX (evidence-ranked)

**Date (UTC):** 2026-10-19  
**Status:** Investigation · research charter for next call slices  
**Parents:** [realtime-media-post-v2-design-2026-10.md](./realtime-media-post-v2-design-2026-10.md) · [m1-video-dial-ui-design-2026-10.md](./m1-video-dial-ui-design-2026-10.md) · PB1-C honesty designs  
**Charter:** Maintainer — continue video/voice improvements for performance, stability, UI/UX with **rigorous research**, not subjective “better.”

```text
HANDOFF ATOMIC STEP: S2 Track L BLOCKED · M1-L3 blocked (no camera) · charter: call research
PAUSED / CANCELLED: Claim video usable · Gift fake-video · Soft L3 Fixed · heavy mobile-shell repro without host-check
CANONICAL OWNER:     messaging realtime voice / WebRTC · VoiceCallDock
PROOF BEFORE DONE:   This doc ranks gaps with measurable criteria; no “polish” without a metric or honesty contract
SURFACE:             1:1 voice (shipped) · video structure (M1-A/B/C) · not conference
```

## Method (what counts as rigorous here)

| Allowed evidence | Not allowed as “done” |
|------------------|------------------------|
| Existing diagnostics / logs (`messaging.realtime_voice.*`) | “Feels smoother” |
| L1 fixtures against WebRTC stats shapes | Desktop preview “looks nicer” without a contract |
| Lifecycle invariants (recovery API vs wire) | Claiming video usable without M1-L3 |
| Industry-standard WebRTC metrics (RTT, loss, jitter, ICE) | M2/M3 conference work without charter |
| Named soak procedures already in repo | Heavy Playwright / mobile-shell while host-pressure fails |

**Baseline today:** voice 1:1 works with PB1-C honesty on dial/timeout/dispatch. Video dial + mobile fullscreen exist structurally. **No camera → no M1-L3 / no video usability claim.**

## Inventory — what we already measure

| Signal | Where | Gap |
|--------|-------|-----|
| Session phase transitions | `realtime-voice-session-diagnostics` → `session_transition` | No media quality |
| RTC `connectionState` changes | `main-shell` → `rtc_state` | Logs only; no ICE/candidate-pair detail |
| Joiner accept→connected ms | `join_connected.acceptToConnectedElapsedMs` | Host dial→connected **not** timed |
| Connect timeout decision | `realtime-voice-timeout-policy` | Progress = SDP/state heuristics, **not** bytes/packets |
| Wave audio level (UI) | `advanceVoiceWaveAudioLevelChannel` | Decorative; not QoS |
| **`RTCPeerConnection.getStats()`** | **Absent** in messaging | **Cannot prove perf regressions or network quality** |

## Inventory — stability wiring

| Behavior | Code fact | Risk |
|----------|-----------|------|
| `disconnected` / `failed` | Immediately `phase: "interrupted"` + `network_interrupted` | Brief ICE flaps end the call; no grace |
| Session owner `requestRecovery` | Implemented on lifecycle owner | **Never called from `main-shell`** |
| ICE restart / renegotiation | Not found on call path | Recovery state machine is ornamental for RTC |
| ICE servers | Public STUN only (Google + Twilio) | No TURN → symmetric NAT / many corp nets fail with no operator-configurable path |
| Ring / connect timeouts | PB1-C landed | Good honesty; not a substitute for mid-call recovery |

## Inventory — UI/UX (contract vs taste)

| Surface | Status | Research note |
|---------|--------|---------------|
| Mobile video fullscreen | L1 landed | Contract in m1-video-dial-ui-design |
| Desktop floating dock | Explicitly deferred | Do not enlarge without a design + proof |
| Camera / lab banners | M1-B/C honesty | Keep; do not soften into “video works” |
| Voice compact dock | Shipped | Change only if a measured problem (e.g. control miss-hit rate) is named |

UI changes without a honesty/metric contract are **out of order** for this charter.

## Ranked opportunities (evidence → next slice)

### R1 — Call quality stats snapshot (instrumentation) — **P0 research foundation**

**Why first:** Every “performance” claim after this needs numbers. Industry WebRTC ops use selected candidate-pair RTT, inbound packet loss, jitter, and bytes/s. We have zero of that.

**Measurable contract:** Pure helper parses a stats report (or mock) → `{ rttMs, packetLossRatio, jitterMs, inboundAudioBytes, inboundVideoBytes, iceState }`; optional diagnostic emit while `phase === "connected"` at a capped interval (e.g. ≤1 Hz).

**Proof:** L1 unit tests with fixture reports. No camera. No live soak required to land the helper.

**Does not claim:** Better call quality — only that quality becomes **observable**.

### R2 — Soft disconnect grace + wire recovery once — **P0 stability**

**Why:** Lifecycle already models degraded→recovery; RTC path treats any `disconnected` as fatal interrupt. Transient Wi‑Fi / ICE renomination flaps will look like “unstable calling” with no media-path retry.

**Measurable contract:** On `disconnected`, enter a grace window (e.g. 3–5s) before `interrupted`; optionally one `iceRestart` / `requestRecovery` if still not `connected`. Log outcome codes. L1 for decision pure functions; L3 voice soak for Pass.

**Blocked for Pass:** Dual-profile voice L3 (relays up). Design + L1 can land camera-less.

### R3 — Host dial→connected latency diagnostic — **P1**

**Why:** Joiner already has `acceptToConnectedElapsedMs`. Host-side dial→connected asymmetry leaves half the funnel unmeasured.

**Contract:** Mirror timing field on host when invite accepted / offer sent → `connected`.

### R4 — ICE / TURN honesty — **P1 (operator / private-trust face)**

**Why:** Launch face is private-trust / own infra. Public STUN-only is an honesty gap for “calls work behind hard NAT.”

**Contract:** Document current STUN-only limit; optional config for TURN URLs (no Twilio-as-landlord default — aligns with realtime-media P2). Fail with honest toast when ICE fails after candidates exhausted (if distinguishable).

**Non-goal:** Bundling a paid TURN landlord as default.

### R5 — Desktop video stage redesign — **P2 UX (deferred)**

Already deferred in m1-video-dial-ui-design. Reopen only with a written layout contract + L1 dock tests; still **not** video usable without M1-L3.

### Out of band (do not open under this charter)

| Item | Reason |
|------|--------|
| M1-L3 AV soak | No camera |
| M2/M3 conference | Separate charter after M1 Verified |
| Import Key freeze / heavy mobile-shell | CANCELLED · host freeze class |
| S2 hitch | Docker / stacks down |

## Recommended next atomic step

1. Land **R1 design + L1 helper** (stats snapshot) so later perf work is evidence-backed.  
2. Then **R2 design** (soft disconnect) as the first stability change with a named grace + recovery contract.  
3. Hold R5 desktop UI until R1–R2 exist or maintainer re-charters presentation.

## Claim discipline

| Claim | Allowed when |
|-------|--------------|
| “Calls are more measurable” | R1 L1 Pass |
| “Calls tolerate brief disconnects better” | R2 L1 + voice L3 |
| “Video is usable” | M1-L3 Pass only |
| “Performance improved X%” | Before/after R1 metrics on same path |

_Last updated: 2026-10-19T06:40:00Z_
