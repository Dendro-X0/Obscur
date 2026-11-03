# Website And Test Audit (2026-04-16)

This note captures two release-facing facts:

1. `apps/website` was still a scaffold before the current implementation pass.
2. A small set of tests/scripts still read as incomplete or intentionally gated.

## Website Status Before Implementation

- `apps/website/src/app/page.tsx` was a generic placeholder hero.
- `apps/website/src/app/layout.tsx` still used stock `Create Next App` metadata.
- `apps/website/src/app/globals.css` contained duplicated Tailwind imports and an experimental placeholder visual style rather than a release-facing marketing surface.

## Incomplete Or Gated Test/Script Items

### Explicit placeholder test

- `apps/pwa/app/features/messaging/lib/__tests__/message-queue.test.ts`
  - `"should store message data securely (placeholder for encryption)"`
  - This test explicitly documents itself as placeholder coverage for at-rest encryption verification.

### Intentionally gated e2e

- `apps/pwa/tests/e2e/messaging-flow.spec.ts`
  - Uses `test.skip(!shouldRunRealRelay, ...)`
  - This is not broken, but it is conditional coverage that does not run unless the real-relay environment flag is provided.

### TODO-driven older utility surfaces that still deserve cleanup

- `apps/pwa/app/components/invites/invite-link-manager.tsx`
- `apps/pwa/app/components/invites/profile-settings.tsx`
- `apps/pwa/app/components/invites/qr-code-generator.tsx`
- `apps/pwa/app/features/invites/utils/nostr-compatibility.ts`

These are not all test scripts themselves, but they still contain explicit TODO/placeholder behavior and should be reviewed before any claim that the older invite utility lane is fully production-complete.

## Recommendation

- Treat the `message-queue` placeholder encryption test as the clearest incomplete test item.
- Treat the real-relay e2e skip as an environment gate, not a bug.
- Treat the older invite utility TODOs as a separate cleanup lane from the official website release lane.
