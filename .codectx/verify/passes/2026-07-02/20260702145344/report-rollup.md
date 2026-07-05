# Verify issue rollup

Updated: `2026-07-02T14:53:44.804206600+00:00`
Issues (deduped view): **14** (+ 19 unmapped captures collapsed)
Investigation chains: **3**

## By symptom (deduped)

| symptomId | count | severity | step | chain | primary evidence |
| --- | ---: | --- | ---: | --- | --- |
| group-thread-relay-ingest | 14 | p0 | 7 | chain-o4-group-ingest-2026-07-02 | `.codectx/verify/client-sessions/csess-6f1a35b7762b/captures/cap-a45dd4eacd8f/screenshot.png` |
| community-roster-divergence | 8 | p0 | 5 | — | `.codectx/verify/client-sessions/csess-c9e4cc0c3649/captures/cap-2f4dee77faa9/snapshot.yaml` |
| COM-RUN-11 | 7 | p0 | 5 | chain-o4-group-ingest-2026-07-02 | `.codectx/verify/client-sessions/csess-d39f4ab009ee/captures/bcap-82d3ad04daf9/bridge-result.json` |
| dm-vanishes-cold-restart | 2 | p0 | 6 | — | `.codectx/verify/client-sessions/csess-6b9fe53b4ded/captures/cap-921a04f7d166/snapshot.yaml` |
| group-room-key-missing | 2 | p0 | 7 | chain-o4-group-ingest-2026-07-02 | `.codectx/verify/client-sessions/csess-87ec64010847/captures/cap-29d052b53b74/screenshot.png` |
| groups-ledger-validation | 28 | p1 | — | — | `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-21d585b2704b/screenshot.png` |
| dm-normalize-is-outgoing-mismatch | 3 | p1 | — | — | `.codectx/verify/faults/fault-c4a2d149.json` |
| dm-ui-split-brain | 3 | p2 | 6 | chain-dm-split-brain-2026-07-02 | `.codectx/verify/client-sessions/csess-6f1a35b7762b/captures/cap-e64ce0b26e3d/screenshot.png` |
| coordination-membership-deltas-unreachable | 2 | p2 | — | — | `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-e557cdac9c04/screenshot.png` |
| dm-normalize-outgoing-mismatch | 2 | p2 | — | — | `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-c516dc13d587/screenshot.png` |
| projection-authority-not-ready | 2 | p2 | — | — | `.codectx/verify/client-sessions/csess-56331621b1d9/captures/cap-efd1b97f101b/screenshot.png` |
| auth-keychain-restore-failed | 1 | p2 | — | — | `.codectx/verify/client-sessions/csess-169c06e92cf1/captures/cap-60328be9334e/screenshot.png` |
| _(unmapped faults)_ | 20 | — | — | — | see faults/*.json; run RIW-8 signal extract |

## Chains

_Verdicts are rolled from chain node hypotheses. `partial_accepted` means product path documented with harness gaps in `nonCoverage`. Read node files — not meta-chain `meta-band` edges — for causal order._

| chainId | symptomClass | nodes | status | verdict | split-brain |
| --- | --- | ---: | --- | --- | --- |
| chain-o4-group-ingest-2026-07-02 | group-thread-relay-ingest | 23 | open | partial_accepted | — |
| chain-transport-soak-2026-07-02 | relay-partial-stack-desktop-only | 2 | open | partial_accepted | — |
| chain-dm-split-brain-2026-07-02 | dm-ui-split-brain | 8 | open | partial_accepted | — |

_Capture bundle — not a single root cause. Agents: prefer this file + `issues-register.summary.json` over full `report.json`._
