# Investigation note — relay stability / speed (post manual DM verify)

**Date (UTC):** 2026-08-04  
**Companion:** [peer-metadata-unknown-sender-investigation-2026-08.md](./peer-metadata-unknown-sender-investigation-2026-08.md)  
**Prior band:** Auto-correct D0–D4 Pass · [operator notes](../../docs/program/relay-pool-auto-correction-operator-notes-2026-08.md)

---

## Evidence (maintainer screenshots)

| Profile | Badge / toast |
|---------|----------------|
| Tester2 | Connected **2/3** · toast “Couldn't reach **nos.lol**” |
| Tester1 | Connected **1/4** · toast “Couldn't reach **relay.damus.io**” ×10 |
| Both | DM still works |

**Interpretation:** Partial public-pool reachability is **expected honesty** (no public SLA). Toast spam ×10 and perceived “speed” are separate from DM owner health.

---

## Owners (do not dual-own)

| Concern | Owner today |
|---------|-------------|
| Single/Multi + failover | Mesh when `meshSchedulerOwnsFailover`; else TS D2 policy |
| Connection failure toast | `native-relay.ts` copy · `native-error-store` · `error-panel.tsx` |
| Pool health badge | P14 `deriveRelayRuntimeStatus` |

---

## Recommended follow-ups (after metadata M1)

| ID | Work | Note |
|----|------|------|
| **R1** | Deduplicate / rate-limit “Couldn't reach {host}” toasts (collapse ×N) | **Pass** (L1) — [relay-toast-r1-dedupe-design-2026-08.md](./relay-toast-r1-dedupe-design-2026-08.md) |
| **R2** | Prefer healthier Default Stable members in dial order (already E3/P6 ranked) — verify damus demotion still applied under mesh | Measure before patch |
| **R3** | Optional VPS for team soak | Ops docs already |

Do **not** treat public free-relay latency as a client bug to “fix” with parallel pools.

---

## Claim discipline

- DM Pass (manual) ≠ relay SLA Pass.  
- Degraded K/N + unreachable host toast = honest. Spam ×10 = improve.  
- Soft L3 Docker still not ship proof.
