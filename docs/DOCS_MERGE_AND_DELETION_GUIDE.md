# Docs merge and deletion guide

This repository currently has two documentation roots:

- `dcos/` (design/spec docs)
- `docs/` (deployment/dev/process docs)

If you want a single docs location, treat `docs/` as the canonical folder and move/merge what you want from `dcos/` into it.

## Minimal recommended keep set
If you want the smallest handoff set for a new maintainer:

- `docs/HANDOFF.md`
- `docs/CHANGES_AND_STATE.md`
- `docs/DOCS_MERGE_AND_DELETION_GUIDE.md`
- (optional) `README.md` (root)
- (optional) `PROJECT_STATUS.md` (root)

## Suggested merge mapping (if you do want to keep design context)
Move these from `dcos/` into `docs/design/`:

- `dcos/project-overview.md`
- `dcos/v1-spec-roadmap.md`
- `dcos/hybrid-invite-system.md`
- `dcos/hybrid-coordination-layer.md`
- `dcos/pwa-build-stabilization.md`
- `dcos/project-suspension-status-2026-01-29.md`

Move Worker config notes into `docs/coordination/`:

- `dcos/coordination/*`

## Deletion checklist (manual)
If you plan to delete most markdown files, delete in this order to avoid confusion:

1) Delete the legacy process docs first:
- `docs/archive/**`
- `docs/dev/**`

2) Delete or move `dcos/**` next.

3) Delete per-app markdown sets you do not want:
- `apps/desktop/*.md` (keep only `apps/desktop/README.md` if desired)

4) Finally, clean up root markdowns:
- `ARCHITECTURE_EXPLAINED.md`
- `IMPLEMENTATION_PROGRESS.md`
- `CHANGELOG.md`

## Important note about references
Root `README.md` currently references `apps/api` as an optional API server. If you delete/move the API app or keep docs minimal, you may also want to edit root `README.md` (or delete it) so it doesn’t advertise a component you don’t intend to maintain.
