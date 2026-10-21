# Salvage pathway

**Current:** `truth`

**Paused bands:** `Soft L3 Fixed vanity · invent “heap fixed” without L2/L3 soak`, `Run B full plane before A2 labels chrome`, `Stack rewrite away from Tauri`, `Dozens of micro`

- [x] **Owner conflicts** — `studio_owner_conflicts_get` → `.codectx/verify/owner-conflicts-latest.md`
- [ ] **Truth surface** — `verify_truth_surface_evaluate` → `.codectx/verify/truth-surface-latest.json`
- [ ] **Shell freshness** — `verify_shell_freshness_evaluate` → `.codectx/verify/shell-stamp.json`
- [ ] **Vertical slice** — `verify_vertical_slice_evaluate` → `.codectx/verify/vertical-slice-latest.json`
- [ ] **Freeze set** — `verify_freeze_set_propose` → `.codectx/verify/freeze-set-latest.json`
- [ ] **Salvage rollup** — `verify_salvage_preset_run` → `.codectx/verify/salvage-rollup-latest.md`

- [ ] **Prove** — `verify_operation_prove` (named truth surface only)

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

---
≤1 page · CLAR/RUST4/RCDP4/CVE5


**Subject Next Atomic Step (DFH2):** ```text — 1. host_health on E:\Web Projects\obscur — refuse if disk pegged — 2. pnpm kill:dev-stack

Prefer this over static R-AUTH / vertical-slice template args.
