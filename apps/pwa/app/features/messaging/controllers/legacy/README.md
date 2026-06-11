# Legacy DM controllers (quarantined)

**Not used by production runtime.** Desktop and web shells use `controllers/v2/dm-controller.ts` via `hooks/use-enhanced-dm-controller.ts`.

| File | Purpose |
|------|---------|
| `enhanced-dm-controller.ts` | v1 monolithic hook — historical integration tests only |
| `incoming-dm-event-handler.ts` | v1 incoming path — used only by v1 controller + legacy tests |

Contract gate: `native-dm-legacy-path.contract.test.ts` forbids production imports of these modules.
