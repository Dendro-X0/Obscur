# v1.3.8 Closeout Evidence Packet

This folder stores M2/M3 replay evidence for the `v1.3.8` lane.

Use this packet for remaining closeout work:

1. run automated readiness gates (already completed in this thread):
: `pnpm docs:check`
: `pnpm release:test-pack -- --skip-preflight`
: `pnpm release:streaming-update-contract:check`
2. execute manual replay checklist:
: `docs/assets/demo/v1.3.8/manual-verification-checklist.md`
3. capture diagnostics/events/screenshots under:
: `docs/assets/demo/v1.3.8/raw/`
4. store GIF/screen recordings under:
: `docs/assets/demo/v1.3.8/gifs/`
5. update final status summary:
: `docs/assets/demo/v1.3.8/runtime-evidence-summary.json`

Roadmap closeout conditions are not met until this packet reflects completed manual replay evidence.
