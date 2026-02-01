# Documentation deletion guide

If you want to keep only a minimal handoff record and delete everything else, start here.

## Minimal keep set
- `docs/HANDOFF.md`
- `docs/CHANGES_AND_STATE.md`
- `docs/DOCS_MERGE_AND_DELETION_GUIDE.md`

Optional keeps:
- `README.md`
- `PROJECT_STATUS.md`

## Safe-to-delete candidates (manual)
- `docs/archive/**`
- `docs/dev/**`
- `dcos/**` (unless you want the original design/spec preserved)
- `apps/desktop/*.md` (optional)
- root: `ARCHITECTURE_EXPLAINED.md`, `IMPLEMENTATION_PROGRESS.md`, `CHANGELOG.md`

## After deletion
Run a quick sanity check:

- `pnpm -C apps/pwa build`
- `pnpm -C apps/pwa exec eslint . --quiet`

Docs deletions should not affect builds, but this confirms nothing else was accidentally changed.
