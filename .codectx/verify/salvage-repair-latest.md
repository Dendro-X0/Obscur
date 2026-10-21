## Repair (CVE5)

**Subtractive (no subject patches):**
- `stop-writing-here` `apps/pwa/app/features/groups/hooks/use-community-relay-pool-writable.ts` — Dual-owner lifecycle `relay-publish` — stop writing until ownership clarified (`studio_owner_conflicts_get`)
- `stop-writing-here` `apps/pwa/app/features/groups/services/local-workspace-relay-publish.ts` — Dual-owner lifecycle `relay-publish` — stop writing until ownership clarified (`studio_owner_conflicts_get`)
- `stop-writing-here` `apps/pwa/app/features/groups/services/sealed-community-relay-publish-retry.ts` — Dual-owner lifecycle `relay-publish` — stop writing until ownership clarified (`studio_owner_conflicts_get`)
- `stop-writing-here` `apps/pwa/app/features/relays/hooks/enhanced-relay-pool-port.ts` — Dual-owner lifecycle `relay-publish` — stop writing until ownership clarified (`studio_owner_conflicts_get`)
- `stop-writing-here` `apps/pwa/app/features/relays/hooks/enhanced-relay-pool-types.ts` — Dual-owner lifecycle `relay-publish` — stop writing until ownership clarified (`studio_owner_conflicts_get`)

**Slice:** `R-AUTH` — Default repair validation slice (`verify_vertical_slice_evaluate`)
**Client replay:** `salvage-vibe-ruin` via `verify_scenario_pack_run`
**False-green:** RC0 / wiring-only / T0–T1 cannot close user-visible issues (CVE1/CVE5) (`verify_false_green_scan`)

_subjectPatches: false_

