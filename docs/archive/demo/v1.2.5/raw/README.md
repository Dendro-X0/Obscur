# Raw Capture Inputs

Store raw console outputs here before materializing canonical pass-lane files.

Required file:
1. `m10-v130-release-candidate-capture.json`
: output from `window.obscurM10TrustControls.runV130ReleaseCandidateCaptureStabilizedJson(...)`.

Materialize command:
`pnpm demo:m10:rc:materialize -- --capture docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json`
