# M10 Release Candidate Assets (v1.2.5)

Canonical matrix:
- `docs/35-v1.2.5-m10-release-candidate-matrix.md`

Canonical output files:
1. `m10-v130-release-candidate-pass.json`
2. `m10-v130-release-candidate-capture.json`
3. `m10-digest-summary.json`
4. `m10-event-slices.json`
5. `m10-demo-storyboard.md`

Automation:
1. `pnpm demo:m10:rc:init`
2. `pnpm demo:m10:rc:materialize -- --capture docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json`
3. `pnpm demo:m10:rc:check:structure`
4. `pnpm demo:m10:rc:check`
5. `pnpm demo:m10:rc:status`
6. `pnpm demo:m10:rc:next`
