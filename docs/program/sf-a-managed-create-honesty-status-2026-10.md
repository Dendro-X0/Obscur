# SF-A — Managed create honesty (engineering status)

**Date (UTC):** 2026-10-21  
**Design:** [scale-flexible-group-architecture-design-2026-10.md](../../specs/backend/scale-flexible-group-architecture-design-2026-10.md) §7  
**Roadmap:** [pre-b2b-capability-and-media-roadmap-2026-10.md](./pre-b2b-capability-and-media-roadmap-2026-10.md) §7  
**CU-UX-5:** [community-relay-freedom-design-2026-10.md](../../specs/backend/community-relay-freedom-design-2026-10.md)

---

## Eng claim (this pass)

| Slice | Status | Evidence |
|-------|--------|----------|
| Public Quiet managed create | **Honesty-gated (CU-UX-5)** — superseded hard-block | `public_default_honest` + `requiresHonestyAck` · trust `public_relay_honest` · create dialog Team honesty panel |
| Public Quiet honesty ack for sovereign create | **Implemented** | `create-group-public-relay-honesty` + ack · Vitest in `create-group-dialog.test.tsx` |
| Team + public Quiet honesty ack | **Implemented (CU-UX-5)** | Team honesty keys · submit enabled only after ack · coordination still required |
| ACC-02 directory honesty notice | **Implemented** | `CommunityDirectoryHonestyNotice` · i18n `groups.directoryHonesty.*` |
| Tier chooser copy (SF say / don’t say) | **Updated** | `groups.create.tier.public/team.*` — cell private-trust · no Discord/megagroup claim |
| Cell group live (P5) | **Ops open** | Needs usable shell + EG-LOG rewrite — not claimed |

## L1 proof commands

```bash
pnpm --filter @obscur/pwa exec vitest run app/features/groups/components/create-group-dialog.test.tsx
pnpm --filter @obscur/pwa exec vitest run app/features/groups/services/path-b-b0-exit.contract.test.ts
pnpm --filter @obscur/pwa exec vitest run app/features/groups/services/community-mode-contract.test.ts app/features/groups/services/community-trust-policy.test.ts app/features/groups/services/community-create-relay-catalog.test.ts
```

## Out of scope (SF-B+)

Corp directory / Spaces · discussion profile · SFU — design-first after SF-A ops exit.

_Last updated: 2026-10-21_
