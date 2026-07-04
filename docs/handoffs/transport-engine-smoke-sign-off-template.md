# Transport Engine — Live Desktop Publish Smoke Sign-Off

**Template only.** Copy into handoff when W53 manual smoke completes. Do not commit `PASS` without evidence.

## Metadata

| Field | Value |
|-------|-------|
| Commit hash | `<!-- git rev-parse HEAD -->` |
| Smoke date (UTC) | `<!-- YYYY-MM-DDTHH:MM:SSZ -->` |
| Maintainer | `<!-- name/handle -->` |
| Verify gate | `pnpm verify:transport-engine-w68` (`verify:transport-engine-w53` alias) on smoke commit |

## Lab env used

| Env | Value |
|-----|-------|
| `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY` | `<!-- must not be 1 -->` |
| `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY` | `<!-- 1 for smoke -->` |
| `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK` | `<!-- 1 for smoke -->` |

## W53 checklist results

| # | Step | Result (`PASS` / `FAIL`) | Notes |
|---|------|--------------------------|-------|
| 1 | Pre-flight `verify:transport-engine-w52` / `verify:transport-engine-w68` | | |
| 2 | Desktop boot + native publish owner | | |
| 3 | Authority → host shim journal source | | |
| 4 | Async `engine_invoke_transport_publish_relay_event` | | |
| 5 | Real `RelayPool` per-relay evidence | | |
| 6 | Quorum shape via shared mapper | | |
| 7 | Authority off → legacy fallback | | |
| 8 | Evidence captured | | |

## Evidence summary

- Journal source observed: `<!-- transport_kernel_host_publish_shim or other -->`
- Invoke command observed: `<!-- engine_invoke_transport_publish_relay_event or other -->`
- Multi-relay publish summary: `<!-- e.g. 2/3 success, quorum met -->`

## Decision

**Decision:** `<!-- PASS | BLOCKED -->`

**Blockers (if any):** `<!-- list or none -->`

---

*Standalone `transport-kernel-standalone-publish-legacy.ts` deletion requires `Decision: PASS` plus W55+ deletion charter approval.*
