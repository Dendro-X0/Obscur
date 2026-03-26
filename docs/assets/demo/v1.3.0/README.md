# v1.3.0 Closeout Evidence Packet

This folder stores the manual closeout packet for `v1.3.0`.

Use this packet during final runtime verification before tagging:

1. initialize templates:
: `pnpm demo:v130:init`
2. refresh strict release-candidate evidence:
: `pnpm demo:m10:rc:refresh`
3. run closeout validation pack:
: `pnpm closeout:v130:check`
4. complete manual verification checklist:
: `docs/assets/demo/v1.3.0/manual-verification-checklist.md`
5. capture and attach GIF assets in:
: `docs/assets/demo/v1.3.0/gifs/`
6. record final summary in:
: `docs/assets/demo/v1.3.0/runtime-evidence-summary.json`
