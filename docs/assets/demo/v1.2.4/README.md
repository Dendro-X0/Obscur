# v1.2.4 M10 Demo Asset Bundle

Place generated demo artifacts from `docs/34-v1.2.4-m10-demo-asset-matrix.md` in this folder.

Helper commands:
1. `pnpm demo:m10:init`
2. `pnpm demo:m10:check:structure`
3. `pnpm demo:m10:materialize -- --bundle docs/assets/demo/v1.2.4/raw/m10-v124-demo-bundle.json`
4. `pnpm demo:m10:materialize -- --v130-evidence docs/assets/demo/v1.2.4/raw/m10-v130-evidence-capture.json --digest-bundle docs/assets/demo/v1.2.4/raw/m10-digest-event-bundle.json` (fallback split mode)
5. `pnpm demo:m10:check`
6. `pnpm demo:m10:status` (writes `m10-status.json`)

Raw capture input folder:
1. `docs/assets/demo/v1.2.4/raw/README.md`

Required files:
1. `m10-cp3-readiness-pass.json`
2. `m10-cp3-suite-pass.json`
3. `m10-cp4-closeout-pass.json`
4. `m10-v130-closeout-pass.json`
5. `m10-v130-evidence-pass.json`
6. `m10-digest-summary.json`
7. `m10-event-slices.json`
8. `m10-demo-storyboard.md`

Optional files:
1. `m10-v130-closeout-expected-fail.json`
2. `m10-v130-evidence-expected-fail.json`
3. short capture media (`.gif` or `.mp4`) showing trust-controls interaction and evidence export flow.
4. `m10-status.json` (generated readiness report with `strictReady` field).
