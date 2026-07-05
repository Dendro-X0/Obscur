# Verify repro recipe

Exported at: `2026-07-04T14:15:18.761862900+00:00`

## Context

- workspace: `E:/Web Projects/experimental-workspace/newstart`
- multi-actor round: `true`
- CDP port: 9230
- session id: `csess-3b202577b4d1`
- chain id: `chain-r1-room-key-health-2026-07-04`

## Golden path

1. Scan — `client.runtime.health`
2. Align — restart daemon from workspace root
3. Preflight — `client.stack.preflight`
4. Connect — `client.session.connect` (CDP)
5. Probe — `client.surface.probe`
6. Capture — `client.capture`
7. Digest — `client.runtime.digestPull`
8. Confirm — chain append + `verify.issues.report.export`

## Multi-window stretch (COM-RUN-11)

Run this block **before** golden-path connect when `multiActorRound` is true.

1. MW status — `client.multiwindow.status` (probeBridge)
2. Bridge — `client.agent.bridgeCall` (listWindows / openProfileSlot)
3. Switch — `client.multiwindow.switch`
4. Capture — `client.multiwindow.capture`
5. Connect main — `client.session.connect` (:9230)
6. Connect profile — `client.session.connect` (:9231, alwaysNewSession)

## Sessions

- `csess-3b202577b4d1` — port Some(9230), window `main`, role `Tester1`
- `csess-44f67ea7565d` — port Some(9230), window `main`, role `Tester1`
- `csess-4c4583330873` — port Some(9230), window `main`, role `Tester1`
- `csess-94f4ca6d3332` — port Some(9230), window `main`, role `Tester1`

## Operator notes

- round label: 2026-07-04-r1-room-key-health-t4
- confirmed by: agent
- notes: R1 health hook uses resolveRoomKeyHexForMembershipHealthPanel; warm send + cold restart on NewTest 2
