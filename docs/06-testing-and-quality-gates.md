# Testing and Quality Gates

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Main Test Commands

From repository root:

```bash
pnpm -C apps/pwa test
pnpm -C apps/pwa test:run
pnpm -C apps/pwa test:e2e
pnpm -C apps/pwa exec tsc --noEmit
pnpm -C apps/pwa lint
```

## Targeted Performance Tests

- `use-conversation-messages.test.ts`
- `use-conversation-messages.integration.test.ts`
- `message-persistence-service.test.ts`
- `use-sealed-community.merge.test.ts`

## Expected Merge Requirements

Before merging behavior-impacting work:

1. Targeted tests pass.
2. Typecheck passes.
3. No new lint errors in touched files.
4. Changelog is updated for user-visible behavior.
