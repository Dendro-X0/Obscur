# CI investigation — reliability-gates 42167071556 (beta.6 push)

**Run:** https://github.com/Dendro-X0/Obscur/actions/runs/42167071556  
**Workflow:** reliability-gates  
**Job / step:** `release:test-pack` · Run release test pack (CI gate)  
**Commit:** `41194f7b`  
**Status:** resolved  
**Iteration:** 1

## Failure classification

- **Primary class:** vitest  
- **Secondary:** none this iteration  

## First error

```text
FAIL app/features/search/services/identity-resolver.test.ts
  > rejects private key hex when relay confirms derived pubkey profile
AssertionError: expected true to be false
 ❯ identity-resolver.test.ts:149:23  expect(result.ok).toBe(false)
Duration ~6512ms (author query timeouts)
```

**Sub-step:** pwa vitest slice failed after 101 files passed / 1 failed.

## Context

| Field | Value |
|-------|--------|
| Related product change | Invite discovery `REQ` via `sendToOpen` (not `broadcastEvent`) |
| Full Release | **success** `42167073426` · tag `v2.0.0-beta.6` already published |

## Root cause

Test mock delivered author `EVENT`s only from `broadcastEvent`. Production `queryRelayProfiles` now sends `REQ` on `sendToOpen`. Disambiguation never saw the derived-pubkey kind 0 → returned `null` → hex resolve `ok: true`.

## Fix (this iteration only)

Update identity-resolver private-key test mock to handle `sendToOpen` the same as `broadcastEvent`.

## Local proof

```bash
cd apps/pwa && pnpm exec vitest run app/features/search/services/identity-resolver.test.ts
# 2026-11-06 local: Pass (13 tests with relay-discovery-query)
```
