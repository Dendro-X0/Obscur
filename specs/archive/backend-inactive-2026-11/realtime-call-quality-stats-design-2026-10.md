# Design — Realtime call quality stats snapshot (R1)

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · instrumentation only — does not claim better quality  
**Parent:** [realtime-call-perf-stability-ux-investigation-2026-10.md](./realtime-call-perf-stability-ux-investigation-2026-10.md)  
**Slice:** Investigation **R1** — instrumentation only

```text
HANDOFF ATOMIC STEP: S2 blocked · M1-L3 blocked · charter: call R1 quality stats
PAUSED / CANCELLED: Claim video usable · Claim “better quality” · Soft L3 Fixed · TURN landlord default
CANONICAL OWNER:     messaging realtime-voice quality helper · optional main-shell emit
PROOF BEFORE DONE:   L1 pure parse + sample decision tests; no live AV required
SURFACE:             diagnostics / future dock QoS honesty — not user-facing copy yet
```

## Goal

Make 1:1 call media quality **observable** via a pure stats parser and a capped diagnostic emit while connected. Enables later perf/stability work to cite numbers instead of taste.

## Non-goals

- Changing ICE servers / TURN  
- Soft disconnect / ICE restart (R2)  
- Showing quality meters in the dock UI (needs a separate UX contract after we see real samples)  
- Claiming improved performance  
- Video usable / M1-L3

## Contracts

### Snapshot shape

```ts
type RealtimeCallQualitySnapshot = Readonly<{
  sampledAtUnixMs: number;
  connectionState: RTCPeerConnectionState | "unknown";
  iceConnectionState: RTCIceConnectionState | "unknown";
  /** Selected candidate-pair currentRoundTripTime in ms, or null if absent */
  rttMs: number | null;
  /** inbound-rtp audio: packetsLost / (packetsReceived + packetsLost), or null */
  audioPacketLossRatio: number | null;
  /** inbound-rtp audio jitter (seconds→ms), or null */
  audioJitterMs: number | null;
  inboundAudioBytes: number | null;
  inboundVideoBytes: number | null;
  /** True when any inbound video bytes or video inbound-rtp row exists */
  hasInboundVideoEvidence: boolean;
}>;
```

### Parse rules (deterministic)

1. Prefer `candidate-pair` with `state === "succeeded"` and `nominated === true` (or first succeeded) for `rttMs` from `currentRoundTripTime` (seconds × 1000).  
2. Sum or take primary `inbound-rtp` where `kind === "audio"` / `kind === "video"` (or `mediaType` legacy).  
3. Loss ratio = `packetsLost / max(1, packetsReceived + packetsLost)` clamped to `[0, 1]`; if both missing → null.  
4. Jitter: if `jitter` looks like seconds (< 10), convert to ms; if already large, treat as ms only when clearly ms — prefer W3C seconds → ms.  
5. Never throw on malformed rows; skip unknown types.

### Sample cadence (when wired)

| Rule | Value |
|------|--------|
| Only while UI phase `connected` and PC exists | yes |
| Minimum interval between emits | 1000 ms |
| Diagnostic name | `messaging.realtime_voice.quality_sample` |
| Level | `info`; `warn` if `audioPacketLossRatio >= 0.08` or `rttMs >= 400` |

Thresholds are **diagnostic hints**, not user-facing “bad call” copy (no i18n in this slice).

### Wire site (smallest)

- New module: `apps/pwa/app/features/messaging/services/realtime-call-quality-stats.ts`  
- Register event schema in `log-app-event` allowlist if required  
- Optional: from existing `onconnectionstatechange` / a lightweight interval in `main-shell` **only if** emit is cheap and gated — prefer extracting `shouldEmitRealtimeCallQualitySample({ lastEmitUnixMs, nowUnixMs, phase })` for L1

If main-shell wire risks churn, land **parser + shouldEmit + tests** first; emit wire as same PR only if small.

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | Vitest: fixture stats reports → expected snapshot fields; shouldEmit interval |
| L2 | Optional: log appears once during a local voice call (not required to claim L1 Pass) |
| L3 | Not this slice |

## Claim after Pass

Allowed: “Call quality stats are sampled into diagnostics when connected.”  
Forbidden: “Calls perform better,” “Video quality improved.”

_Last updated: 2026-10-19T06:45:00Z_
