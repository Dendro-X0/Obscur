# Verify issue rollup

Updated: `2026-07-04T14:15:18.761862900+00:00`
Issues (deduped view): **34** (+ 25 unmapped captures collapsed)
Investigation chains: **6**

## By symptom (deduped)

| symptomId | count | severity | step | chain | primary evidence |
| --- | ---: | --- | ---: | --- | --- |
| group-thread-relay-ingest | 13 | p0 | 7 | chain-o4-group-ingest-2026-07-02 | `.codectx/verify/client-sessions/csess-c9e4cc0c3649/captures/cap-3b9283b9eb83/snapshot.yaml` |
| COM-RUN-11 | 10 | p0 | 5 | chain-o4-group-ingest-2026-07-02 | `.codectx/verify/client-sessions/csess-d39f4ab009ee/captures/bcap-82d3ad04daf9/bridge-result.json` |
| community-roster-divergence | 10 | p0 | 5 | chain-o4-group-ingest-2026-07-02 | `.codectx/verify/client-sessions/csess-b91e16538053/captures/cap-fac2a764d545/snapshot.yaml` |
| group-room-key-missing | 5 | p0 | 7 | chain-r1-room-key-health-2026-07-04 | `.codectx/verify/client-sessions/csess-94f4ca6d3332/captures/cap-9742f5be6992/screenshot.png` |
| dm-vanishes-cold-restart | 4 | p0 | 6 | chain-o2-cold-restart-phase1c-2026-07-04 | `.codectx/verify/client-sessions/csess-9c729dc6d96b/captures/cap-0e44f5aea39e/screenshot.png` |
| groups-ledger-validation | 40 | p1 | 1 | chain-o4-group-ingest-2026-07-02 | `.codectx/verify/client-sessions/csess-aa3a9eab9c36/captures/cap-cfae3752ba87/digest.json` |
| dm-normalize-is-outgoing-mismatch | 8 | p1 | — | — | `.codectx/verify/faults/fault-f46681b1.json` |
| groups.room_key_missing_send_blocked | 2 | p1 | — | chain-com-run-11-phase1c-2026-07-04 | `.codectx/verify/client-sessions/csess-44f67ea7565d/captures/cap-dc365d49f13c/screenshot.png` |
| _(unmapped faults)_ | 17 | — | — | — | see faults/*.json; run RIW-8 signal extract |

## Chains

_Verdicts are rolled from chain node hypotheses. `partial_accepted` means product path documented with harness gaps in `nonCoverage`. Read node files — not meta-chain `meta-band` edges — for causal order._

| chainId | symptomClass | nodes | status | verdict | split-brain |
| --- | --- | ---: | --- | --- | --- |
| chain-transport-soak-2026-07-02 | relay-partial-stack-desktop-only | 2 | open | partial_accepted | — |
| chain-dm-split-brain-2026-07-02 | dm-ui-split-brain | 9 | open | partial_accepted | — |
| chain-o4-group-ingest-2026-07-02 | group-thread-relay-ingest | 29 | open | partial_accepted | — |
| chain-o2-cold-restart-phase1c-2026-07-04 | dm-vanishes-cold-restart | 2 | open | partial_accepted | — |
| chain-com-run-11-phase1c-2026-07-04 | invite-role-ecosystem | 8 | open | partial_accepted | — |
| chain-r1-room-key-health-2026-07-04 | group-room-key-missing | 1 | open | partial_accepted | — |

_Capture bundle — not a single root cause. Agents: prefer this file + `issues-register.summary.json` over full `report.json`._
