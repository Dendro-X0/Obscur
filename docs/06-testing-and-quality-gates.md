# Testing and Quality Gates

_Last reviewed: 2026-03-14 (baseline commit ab08104)._


## Main Test Commands

From repository root:

```bash
pnpm -C apps/pwa test
pnpm -C apps/pwa test:run
pnpm -C apps/pwa test:e2e
pnpm -C apps/pwa exec tsc --noEmit
pnpm -C apps/pwa lint
pnpm release:test-pack
```

## R0 Drift-Control Gate

For v0.9 rescue work, `pnpm release:test-pack` is the minimum release-blocking gate.
It must include controller-level determinism checks for:

1. request guard behavior (`enhanced-dm-controller`),
2. incoming routing/verification (`incoming-dm-event-handler`),
3. subscription churn/idempotence (`dm-subscription-manager`, relay subscription manager),
4. relay publish and outbox mapping contracts.

CI enforcement:

1. `.github/workflows/reliability-gates.yml` always runs on PR/main and conditionally executes `pnpm release:test-pack -- --skip-preflight` when reliability-scope files changed.
2. `--skip-preflight` is CI-only so branch/clean-tree checks stay in local `release:preflight` without weakening automated reliability gating.
3. During v0.9 beta recovery, `release:test-pack` should be configured as a required branch-protection status check on `main`.

R1 continuation adds request reliability hard-gates:

1. deterministic request transport state mapping (`request-transport-service.test.ts`),
2. two-user deterministic `10/10` request flow pack with restart checkpoint (`request-transport-deterministic.integration.test.ts`),
3. relay-chaos outbox retry determinism and stale-pending release checks (`use-contact-request-outbox.chaos.test.ts`),
4. relay/NIP probe contract determinism (`relay-nip-probe.test.ts`).

Cross-runtime portability regressions are also release-blocking in the current rescue branch:

1. shared public URL normalization (`public-url.test.ts`),
2. resolved profile metadata fallback/normalization (`use-resolved-profile-metadata.test.ts`),
3. local upload response normalization (`upload-service.test.ts`).

Runtime-boundary parity regressions are release-blocking as well:

1. native adapter timeout/failure mapping (`native-adapters.test.ts`),
2. session native fallback behavior (`session-api.test.ts`),
3. runtime notification parity (`notification-service.test.ts`),
4. crypto runtime selection (`crypto-service-runtime-selection.test.ts`),
5. native event listener parity (`native-event-adapter.test.ts`),
6. standalone shell detection (`runtime-capabilities.test.ts`),
7. native local-media adapter parity (`native-local-media-adapter.test.ts`),
8. native host integration parity (`native-host-adapter.test.ts`),
9. background-service adapter fallback behavior (`background-service.test.ts`),
10. relay-native adapter parity (`relay-native-adapter.test.ts`),
11. native relay bridge behavior (`native-relay.test.ts`).

Path B v1 activation + transport-owner convergence regressions are release-blocking for the current account-sync cutover phase:

1. projection/runtime transport gating and owner invariant flow (`runtime-activation-transport-gate.integration.test.tsx`),
2. activation manager projection-ready + owner invariant diagnostics (`runtime-activation-manager.test.tsx`),
3. runtime singleton transport owner gating across runtime/projection flaps (`runtime-messaging-transport-owner-provider.test.tsx`),
4. transport runtime owner/queue invariant counters (`messaging-transport-runtime.test.ts`).

Path B v1 cross-device convergence remains release-blocking with a manual gate in addition to automated suites:

1. run the full manual checklist in `docs/14-regression-playbooks.md` section `10) Path B v1 Cross-Device Account Sync Manual Gate (Phase 2)`,
2. pass 3 consecutive desktop(A) + web guest(B) new-device cycles with no `accepted -> stranger` regression,
3. preserve historical DM timeline visibility across each guest/new-device login cycle,
4. preserve startup readiness evidence (`projection ready`) and transport-owner invariant (`incoming=1`, `queue=1`) in each cycle.

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
5. For v0.9 rescue slices, docs status claims and gate status must remain synchronized (no "working" claims without deterministic gate evidence).
