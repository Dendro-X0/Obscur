# Core Change Checklist

Use this checklist before and after changes to identity, auth, profiles, relays, requests, messaging, or account sync.

## Before Editing

1. Name the canonical owner for the flow.
2. List any parallel paths that also mutate the same state.
3. Identify the explicit scope required:
   - window,
   - profile,
   - identity,
   - relay scope,
   - conversation/request owner.
4. Decide what proof counts as success:
   - local persistence,
   - relay acceptance,
   - recipient evidence,
   - sync completion.

## During Editing

1. Prefer one typed contract over multiple conventions.
2. Remove or quarantine overlapping mutation paths when feasible.
3. Add diagnostics where runtime truth is otherwise invisible.
4. Keep unsupported/degraded behavior explicit and typed.

## Before Closing Work

1. Run focused tests and typecheck.
2. Confirm the change does not introduce optimistic success without evidence.
3. Update docs/changelog if the change affects architecture, rollout status, or release risk.
4. Record remaining blockers if the fix is partial.

