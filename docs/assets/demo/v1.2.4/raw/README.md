# Raw Capture Inputs

Store raw console outputs here before materializing canonical pass-lane files.

Recommended files:
1. `m10-v124-demo-bundle.json`
: output from `window.obscurM10TrustControls.runV124DemoAssetBundleCaptureJson(...)`.
2. `m10-v130-evidence-capture.json`
: output from `window.obscurM10TrustControls.runV130EvidenceCaptureJson(...)`.
3. `m10-digest-event-bundle.json`
: output from the digest/event bundle command in the M10 demo asset flow scripts.

Materialize command (preferred, one-shot bundle):
`pnpm demo:m10:materialize -- --bundle docs/assets/demo/v1.2.4/raw/m10-v124-demo-bundle.json`

Materialize command (split mode fallback):
`pnpm demo:m10:materialize -- --v130-evidence docs/assets/demo/v1.2.4/raw/m10-v130-evidence-capture.json --digest-bundle docs/assets/demo/v1.2.4/raw/m10-digest-event-bundle.json`
