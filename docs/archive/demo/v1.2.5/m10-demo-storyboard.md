# m10 Release Candidate Storyboard (v1.2.5)

_Status: pending capture_

## Segment 1: One-Shot Candidate Capture
1. Clear app events and run one command:
: `window.obscurM10TrustControls.runV130ReleaseCandidateCaptureStabilizedJson(...)`
2. Save raw output in `docs/assets/demo/v1.2.5/raw/`.

## Segment 2: Gate Readout
1. Show `releaseCandidateGate.pass` and `failedChecks`.
2. Confirm nested CP2/CP3/CP4/v130 gate posture is visible in the same payload.

## Segment 3: Digest + Event Correlation
1. Show `summary.m10TrustControls` from `m10-digest-summary.json`.
2. Show event chain slices in `m10-event-slices.json`.
