# CI investigation — release:test-pack tsc (beta.2)

**Job:** reliability-gates / release:test-pack (push)  
**Class:** typecheck (`pnpm -C apps/pwa exec tsc --noEmit`)  
**Date:** 2026-10-25

## Errors (test fixtures only)

| File | Issue |
|------|--------|
| `use-chat-vault-save-with-unlock.test.tsx` | TS2556 spread not tuple/rest |
| `request-transport-service.test.ts` | mock missing `messageId`/`eventId`; `deliveryStatus` widened to `string` |
| `resolve-contact-relationship-actions.test.ts` | projection fixture missing `sync`/`lastSequence`/`updatedAtUnixMs` |
| `post-paint-idle-schedule.test.ts` | mocked schedule fn typed `never` (not callable) |
| `identity-binding-accept-dialog.test.tsx` | identity summary fixture incomplete |
| `native-storage-at-rest-service.sqlite-gate.test.ts` | `AdapterResult` failure needs `reason` |

## Fix

Align test mocks/fixtures with current production types. No product behavior change.

_Last updated: 2026-10-25T15:20:00Z_
