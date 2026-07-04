# CodaCtrl improvement findings — Obscur runtime capture (2026-07)

**Audience:** CodaCtrl maintainers  
**Source:** Runtime Issue Investigation Workflows RIW-1–8 (2026-06-30 → 2026-07-01)  
**Subject app:** Obscur desktop (`pnpm dev:desktop -- --online --skip-build`)  
**MCP server:** `user-codactrl-studio` (workflow guide v1.4.0–1.5.0)  
**Related charter:** [runtime-issue-investigation-workflows-2026-06.md](./runtime-issue-investigation-workflows-2026-06.md)

This document compiles capture-session findings into **actionable CodaCtrl improvements**. Obscur product bugs are summarized for context only — they are not CodaCtrl defects unless noted.

---

## Validated in round 2 (2026-07-02 — boot-artifacts pass)

Round label: `2026-07-02-codactrl-boot-artifacts-round-r2` · Session `csess-510a62aba320` / `csess-6b9fe53b4ded`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `report-rollup.md` | **Works** | Symptom table with `step` + `chain` columns; ~45 lines agent boot |
| `report-lite.json` | **Works** | Chain registry + fault stubs without full digest |
| `issues-register.summary.json` | **Works** | `trackerStep`, `chainId`, `occurrenceCount` on top rows |
| `agent-handoff.md` | **Works** | Operator round + read-first list |
| `verify_dogfood_preflight` | **Works** | Boot artifact presence checks (orange → green after export) |
| `verify_agent_boot_status` | **Works** | All 5 read-order paths present post-export |
| `client_issue_create` `trackerStep` / `chainId` | **Works** | Rollup shows step 6 / 7 on symptoms |
| Fault `digestPath` split | **Works** | `fault-d91cd690.digest.json` separate from metadata |
| `verify_report_sync` | **Still flaky** | File lock when Studio holds `.codactrl` (export alone sufficient) |
| `signalsExtract` on faults | **Still empty** | `symptomIds: []` on new faults — RIW-8 gap remains |
| Rollup fault rows | **Still noisy** | Unmapped faults show `symptomId: —` in table |

---

## Validated in round 3 (2026-07-02 — dedup + export merge)

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `priorChapters` on issues | **Works** | O-4 shows 4 chapters; O-2 shows round2 t4 as latest |
| `canonicalTitle` in summary | **Works** | `issues-register.summary@0.2.0` — latest title wins |
| `chapterCount` | **Works** | e.g. `group-thread-relay-ingest` ×4 |
| Rollup fault collapse | **Works** | Single `_(unmapped faults)_` row (20) |
| `export-manifest.json` | **Works** | `roundLabel`, `authoritativeNotes`, repro context preserved |
| Summary `updatedAt` sync | **Works** | Matches export at `16:55:09` |
| `signalsExtract` on faults | **Still empty** | RIW-8 gap remains |

## Validated in round 4 (2026-07-02 — COM-RUN-02 + RIW-9 wait probe)

Round label: `2026-07-02-codactrl-round4` · Session `csess-631c3bba5207` · Export `20260701165850`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `group-room-key-missing` symptom row | **Works** | New deduped symptom in rollup; linked to `chain-o4-group-ingest-2026-07-02` |
| `client_investigation_chain_append` `waitMs` | **Works** | RIW-9 n5: 30s wait + surface probe captured in one node |
| Chain node count sync | **Works** | Rollup shows O-4 chain **5** nodes, DM chain **6** nodes |
| `export-manifest.json` repro block | **Works** | `chainId`, `sessionId`, `cdpPort`, `authoritativeNotes` preserved |
| Register count | **38** rows | +2 vs round3 (`43cde0c4…` + fault import) |
| `signalsExtract` on faults | **Still empty** | `fault-fc0c8590` unmapped despite `groups.membership_health_snapshot` in digest |
| Map `membership_health_snapshot` blockers | **Gap** | Blockers string not auto-mapped to `group-room-key-missing` |

**CodaCtrl backlog from round4:** Extend RIW-8 signal extract for `groups.membership_health_snapshot` → `group-room-key-missing` when `blockers` contains `room_key_missing`.

**UX-gate audit (2026-07-03 — static, no CodaCtrl):** Full investigation [obscur-ux-gate-investigation-2026-07.md](./obscur-ux-gate-investigation-2026-07.md) · register [obscur-ux-gate-register.v1.json](./obscur-ux-gate-register.v1.json). Proposes future lane `verify:ux-gate-audit` with rule pack `obscur-ux-gate-v1` (§10).

**FLS feature case study (2026-07-03 — filed in CodaCtrl repo):** [fls-obscur-case-study-2026-07.md](E:/Experimental projects/codactrl/docs/studio/evidence/fls-obscur-case-study-2026-07.md) · spec [functional-logic-specification.md](E:/Experimental projects/codactrl/docs/specs/functional-logic-specification.md) · fixtures `codactrl/docs/studio/evidence/fixtures/obscur-fls-*.json`. Proposes **FLS0–FLS3** band: declarative functional logic → static scan + runtime monitoring → contradiction register.

## Round 5 note (2026-07-02 — O-4 relay retry blocked)

| Item | Result |
|------|--------|
| `pnpm dev:relay:docker` | **Failed** — Docker Desktop not running on maintainer machine |
| O-4 send retry | **Still blocked** — composer clears, no bubble; `group-thread-relay-ingest` now **×5** chapters |
| Export | `2026-07-02-codactrl-round5` · archive `20260701171404` · register **39** rows |
| Chain | `n5-round5-send-blocked-no-docker` on `chain-o4-group-ingest-2026-07-02` (6 nodes) |

**Maintainer action to unblock relay isolation:** Start Docker Desktop, then `pnpm dev:relay:docker` before next O-4 pass.

## Round 6 note (2026-07-02 — full stack breakthrough)

Round label: `2026-07-02-codactrl-round6` · Session `csess-631c3bba5207` · Export `20260701172908`

| Item | Result |
|------|--------|
| Docker relay | **Up** — `:7000` listening, banner **2/6** relays |
| COM-RUN-02 health | Transient `room_key_missing` → **`ready:1` `chatEnabled:1`** after Info/coordination cascade |
| O-4 send | **`O4-round6-docker-up-071T1728` visible** + `publishGroupEvent` to `ws://localhost:7000` |
| UI divergence | Sidebar still shows group-key warning while health ready |
| RIW-9 n6 | Re-open Tester2 DM stable — 11 msgs, `splitBrainSuspected=false` |
| Register | **40** rows · `group-thread-relay-ingest` ×6 chapters |

**CodaCtrl note:** Chain verdict on O-4 chain should flip from `blocked` → `partial` when latest node shows send success (rollup currently lags operator verdict).

## Round 7 note (2026-07-02 — reproducibility + roster regression)

| Item | Result |
|------|--------|
| Stack | Docker + coordination restarted |
| O-4 | **Second send** `O4-round7-fullstack-071T1733` — reproducible on warm session |
| COM-RUN-01 | Manage Participants **dropped to 1** (was 2 in round3) vs chat header **2 members** |
| RIW-5 | Transport chain `n2-full-stack-round7` — Connected & optimized on `:7000` |
| Register | **43** rows |

---

## Validated in round 10 (2026-07-02 — CodaCtrl update pass)

Round label: `2026-07-02-codactrl-round10` · Session `csess-ad3b3e90aa04` · Export `20260701220635`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `verify.issues.register@0.3.0` triage | **Works** | Raw 46 → **15** rows (14 symptoms + unmapped ×33 bucket); `triageIssueCount: 14` |
| `verify_issues_promote` | **Works** | COM-RUN-02 `d6aaccca…` → stage **spec**, status **investigating** |
| `meta-chain.json` | **Works** | Exported on round10; symptom adjacency graph with rootBand |
| `verify_workflow_guide@1.2.0` | **Works** | Documents promote + sinceEtag poll + meta-chain read order |
| `verify_dogfood_preflight@0.2.0` | **Partial** | `meta-chain` missing until export; register triage check failed pre-export |
| Rollup triage view | **Works** | **14** deduped symptoms (+ unmapped collapsed); O-4 ×9 chapters |
| `sinceEtag` poll | **Works** | Etag updates after export |
| `signalsExtract` on faults | **Still empty** | RIW-8 gap; unmapped bucket tracks ×33 |
| Scenario `vrun-31d8d75b` | **Quarantined** | Listed as `quarantinedScenarioRunId` in register v0.3 |

**Obscur product (round10):** Docker down → O-4 send blocked (repro); COM-RUN-01 unchanged; RIW-1 18/20 invalid unchanged.

**CodaCtrl backlog:** `verify_agent_boot_status` should mark `meta-chain.json` present immediately after export sync; auto-map `groups.ledger_validation_issues` → `groups-ledger-validation`.

---

## Validated in round 11 (2026-07-02 — feedback iteration + multi-window probe)

Round label: `2026-07-02-codactrl-round11` · Session `csess-af73d0bd5b5c` · Export `20260701223753`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `verify_dogfood_preflight@0.2.0` | **Works** | All 8 checks green including meta-chain + register triage |
| `verify_agent_boot_status` | **Works** | All boot artifacts present immediately post-export |
| `promotionStage` on register rows | **Works** | COM-RUN-02 `d6aaccca…` shows `promotionStage: spec` in `verify_issues_list` |
| Chapter dedupe | **Works** | O-4 ×10, COM-RUN-01 ×5, multi-window ×2 — register stays **15** rows |
| Chain rollup verdict | **Partial** | `chain-dm-split-brain` → **partial_accepted**; O-4 still **blocked_on_harness** despite rounds 6–8 success |
| Multi-window probe | **Documented** | Native window opens; `:9231` not listening; cannot attach second profile |
| `signalsExtract` / fault auto-map | **Still empty** | `verify_fault_import` → `symptomIds: []`; unmapped ×36 |

**Obscur product (round11):** Docker down → O-4 send blocked; COM-RUN-01 unchanged; profile slot empty (Tester2 not configured).

**Remaining gap:** Per-window CDP on secondary Tauri WebView2 environments (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` on every window) or WebDriver `:4445`.

---

## Validated in round 12 (2026-07-02 — trace desk v1.4 + full stack)

Round label: `2026-07-02-codactrl-round12` · Session `csess-ad9e7520da13` · Export `20260702084757`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `verify_workflow_guide@1.4.0` | **Works** | Adds `traceDesk` playbook + `coldRestartProve` contract path |
| `verify_trace_latest` | **Works** | Timeline merges chains, issues, MCP audit for symptom filter |
| `verify_envelope_suggest` | **Partial** | Returns perspective YAML; `evidenceBeforeDone` still points at quarantined `vrun-31d8d75b` not live capture |
| Debug Desk preflight | **Works** | All 8 checks green; Studio shows signal quality strip |
| Full-stack O-4 repro | **Works** | Send visible with Docker up (repro rounds 6–8 pattern) |
| Chain verdict rollup | **Still wrong** | O-4 chain `blocked_on_harness` despite n13 success node — operator should set `partial_accepted` |
| `signalsExtract` | **Still empty** | Unmapped ×39–40 |

**Obscur product (round12):** Send works full stack; COM-RUN-01 roster divergence unchanged; sidebar key warning stale.

---

## Validated in round 13 (2026-07-02 — post-rebuild + agent bridge)

Round label: `2026-07-02-codactrl-round13` · Session `csess-937c30f83699` · Export `20260702095924`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Obscur `__codactrlAgentBridge` | **Works** | Shipped in rebuild; `listWindows` + `openProfileSlot` pass via MCP |
| `client.agent.bridgeCall` + `bcap-*` | **Works** | Structured `pass: true` when bridge returns `ok: true`; errors captured on ACL deny |
| `openProfileSlot(2)` | **Works** | Opens `profile-profile-2-*` native window (`Profile 2` registered) |
| `focusWindow` | **Blocked** | Tauri ACL: `core:window:allow-set-focus` not granted to bridge |
| `listWindows` after open | **Works** | Returns 2 rows; second window `visible: false` until native reveal |
| O-4 full-stack send | **Works** | Post-rebuild send + `publishGroupEvent` @ `:7000` |
| CDP dual attach | **Still blocked** | `:9231` down; probe still recommends agent-bridge lane |
| `verify_trace_latest` | **Works** | Live MCP audit rows for `client.agent.bridgeCall` in timeline |
| Export repro context | **Works** | `roundLabel` + `sessionId` `csess-937c30f83699` on manifest |
| `verify_envelope_suggest` | **Still stale** | Historical `vrun-31d8d75b` pointer unchanged |

**Obscur product (round13):** COM-RUN-01 unchanged; RIW-1 ledger 18/20 invalid; sidebar key warning stale; profile-2 window opens but not MCP-drivable.

**CodaCtrl backlog from round13:** Grant Tauri window focus/show ACL for dev-lab bridge; teach `agent-window-probe` that bridge `listWindows.length >= 2` is partial dual-window ready; map `focusWindow` ACL errors to harness finding not opaque RPC error.

---

## Validated in round 14 (2026-07-02 — ACL/CDP rebuild + CodaCtrl update)

Round label: `2026-07-02-codactrl-round14` · Session `csess-c9e4cc0c3649` · Export `20260702110342`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `desktop_agent_focus_window` IPC | **Works** | `focusWindow` → `invoked: desktop_agent_focus_window`; `bcap-*` `pass: true` |
| `openProfileSlot(2)` + `listWindows` | **Works** | 2 windows; profile window `visible: true`, `focused: true` after open |
| O-4 full-stack send | **Works** | `O4-round14-acl-cdp-072T1102` visible after send |
| CDP dual attach | **Still blocked** | `:9231` not listening; `client_multiwindow_status` honesty gate correct |
| Chain integrity | **Improved** | n14 linked in manifest; round14 nodes n16–n17 appended with edges |
| Rollup evidence refs | **Improved** | Top O-4/COM-RUN-11 rows point at round14 session captures |
| RIW-8 unmapped bucket | **Improved** | Rollup `_(unmapped faults)_` **20** (was 40); `groups-ledger-validation` auto-count **24** |
| Rollup verdict note | **Improved** | Footer warns: read chain **nodes**, not meta-chain `meta-band`, for causal order |
| O-4 chain verdict | **Still wrong** | Rollup `blocked_on_harness` despite rounds 6–14 send success nodes |
| `verify_envelope_suggest` | **Still stale** | Historical `vrun-31d8d75b` pointer unchanged |

**Obscur product (round14):** COM-RUN-01 unchanged; focus IPC unblocks bridge focus; profile-2 window opens but still no CDP/UI attach on second webview.

**CodaCtrl backlog from round14:** Auto-flip O-4 chain verdict to `partial_accepted` when latest node is send-success + document COM-RUN-11 harness gap in `nonCoverage`; wire `:9231` listen detection into `agent-window-probe` partial-ready when bridge reports 2 windows.

---

## Validated in round 15 (2026-07-02 — per-window CDP :9231)

Round label: `2026-07-02-codactrl-round15` · Sessions `csess-d39f4ab009ee` + `csess-9530bb91b194` · Export `20260702111456`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Per-window CDP (Obscur) | **Works** | Unset global `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`; builder args on main + profile |
| `:9231` profile CDP | **Works** | Listens after `openProfileSlot(2)`; target on `/sign-in` |
| `client_session_connect` @ `:9231` | **Works** | Profile session `csess-9530bb91b194` |
| `agent-window-probe` v0.1.1 | **Works** | `dualWindowReady: true` when both CDP ports have targets |
| COM-RUN-11 full ingest | **Not yet** | Profile window at sign-in; Tester2 unlock/send not driven on `:9231` |

**Obscur product (round15):** Dual CDP attach unblocked — major COM-RUN-11 harness gap closed.

**CodaCtrl backlog from round15:** Drive Tester2 unlock on `:9231` session; fix `agent-bridge-call.mjs` race when Playwright reconnects during probe.

---

## Validated in round 16 (2026-07-02 — dual-profile unlock + send)

Round label: `2026-07-02-codactrl-round16` · Sessions `csess-1462fcbd345e` + `csess-e440bdda1773` · Export `20260702111911`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Tester2 unlock on `:9231` | **Works** | Profile sign-in → messenger shell |
| Tester2 send on `:9231` | **Works** | DM to Tester1 (`O4-round16-profile2-072T1118`) |
| Tester1 community send on `:9230` | **Works** | NewTest 2 (`O4-round16-dual-profile-072T1117`) |
| `dualWindowReady` | **Works** | Both CDP ports with live targets |
| COM-RUN-11 invite UX | **Not exercised** | Tester2 has no Communities sidebar row; historical invites superseded |
| COM-RUN-01 roster | **Unchanged** | Not re-tested this round |

**Obscur product (round16):** COM-RUN-11 **harness gap closed** for dual-profile CDP automation — product invite UX still open.

**CodaCtrl backlog from round16:** Fresh invite fixture for COM-RUN-11 t4; harden `agent-bridge-call.mjs` CDP page-closed race; auto-flip O-4 chain verdict to `partial_accepted`.

---

## Validated in round 17 (2026-07-02 — CodaCtrl stack preflight)

Round label: `2026-07-02-codactrl-round17` · Sessions `csess-8abe3d68a490` + `csess-a256b15c946e` · Chain node `n20` (export pending Studio sync)

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `client_stack_preflight` | **Works** | Blocks connect until relay :7000 + coordination :8787 + CDP :9230 |
| `skipStackPreflight` on connect | **Works** | Escape hatch when partial stack acceptable |
| Profile `windowLabel` on :9231 | **Fixed** | Now `profile-2` in session.json (CC-EVAL-08) |
| `excludeProbePorts` 9222 | **Works** | `client_dev_environment_get` no longer attaches Studio |
| Dual-profile harness | **Works** | Tester2 unlock + DM send on profile-2 |
| O-4 group send | **Blocked** | Docker Desktop not running → :7000 down |
| `verify_issues_report_export` | **Failed** | codactrld timeout — operator Studio export needed |
| O-4 chain verdict rollup | **Still wrong** | 21 nodes, still `blocked_on_harness` |

**CodaCtrl backlog from round17:** Structured JSON response from `client_stack_preflight` (currently text-only on fail); auto chain verdict flip; codactrld resilience under load; complete export after chain append.

---

## Validated in round 17b (2026-07-02 — Docker retry, full stack send)

Round label: `2026-07-02-codactrl-round17` (17b) · Session `csess-6f1a35b7762b` · Export `20260702132859` (partial coherence — rollup stale at 13:09)

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Stack preflight all green | **Works** | Connect without `skipStackPreflight` |
| O-4 send with Docker | **Works** | `O4-round17b-docker-072T1323` |
| Chain n21 | **Works** | Send-success node with digest + surfaces |
| Export bundle coherence | **Failed** | Manifest 13:28 vs rollup/handoff/lite 13:09 (CC-EVAL-25) |
| Chain verdict rollup | **Failed** | Still `blocked_on_harness` after n21 (CC-EVAL-04) |

---

## Validated in round 18 (2026-07-02 — export coherence + verdict rollup)

Round label: `2026-07-02-codactrl-round18` · Sessions `csess-6f1a35b7762b` + `csess-624f7d067178` · Export `20260702144547`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| **CC-EVAL-25** atomic export | **Fixed** | `export-bundle-coherence.json` → `coherent: true`; 9 artifacts same `exportedAt` |
| **CC-EVAL-04** verdict rollup | **Fixed** | O-4 chain 23 nodes → `partial_accepted`; `nonCoverage` = COM-RUN-11/01 |
| **CC-EVAL-17** primary evidence | **Fixed** | `cap-a45dd4eacd8f/screenshot.png`; chapterCount 14; n22 in priorChapters |
| **CC-EVAL-28** golden path preflight | **Fixed** | `repro-recipe.json` step 2 = `client_stack_preflight` |
| **CC-EVAL-16** MCP export reliability | **Fixed** | Single export succeeded; pass archive written |
| **CC-EVAL-26** pass archive | **Fixed** | `20260702144547` matches export timestamp |
| **CC-EVAL-27** repro-recipe sync | **Fixed** | Session `csess-6f1a35b7762b`; round18 notes |
| O-4 send | **Works** | `O4-round18-codactrl-072T1445` visible |
| Profile `:9231` attach | **Works** | `windowLabel: profile-2` on `csess-624f7d067178` |
| `client_stack_preflight` | **Works** | Blocked on `:8787` during coord cold-start |
| `form button[type="submit"]` unlock | **Works** | Avoids `:has-text("Log In")` strict-mode violation |
| Coordination cold-start | **Harness gap** | Wrangler >3 min on Windows; preflight correctly blocks |

**CodaCtrl backlog from round18:** Coordination warm-start hint in preflight fix commands; golden path step numbering duplicate (steps 2 and 2); Tester2 unlock on `:9231` not exercised; COM-RUN-11 invite fixture still needed.

---

## Validated in round 19 (2026-07-02 — dual-profile interactive DM)

Round label: `2026-07-02-codactrl-round19` · Sessions `csess-6f1a35b7762b` + `csess-64c34e63c6eb` · Export `20260702145344`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Dual-profile DM round-trip | **Works** | `DM-round19-t1/t2-072T1452/1453` visible both windows |
| Export bundle coherence | **Works** | `coherent: true` |
| Chain append | **Partial** | Edge `from: n6-round16-dual-profile-dm` — node does not exist (should be `n6-reopen-thread-probe`) |
| Scenario templates | **Shipped** | Catalog includes `scenario.dual-dm-roundtrip@1` |

**CodaCtrl backlog from round19:** Chain edge auto-correct on append; `chain-integrity.json` in export bundle.

---

## Validated in round 20 (2026-07-02 — CC-EVAL-29–32 post-upgrade)

Round label: `2026-07-02-codactrl-round20` · Sessions `csess-6f1a35b7762b` + `csess-b91e16538053` · Export `20260702161159`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| **CC-EVAL-29** RIW-8 signal extract | **Fixed** | Digest pulls return non-empty `symptomIds` + `signalsExtract` |
| **CC-EVAL-30** chain integrity export | **Partial** | `chain-integrity.json` present; `coherent: false` due to legacy DM dangling edge |
| **CC-EVAL-31** multi-session repro | **Works** | `repro.sessions` lists T1+T2 round20 ids (among historical sessions) |
| **CC-EVAL-32** selector pack v1.1 | **Works** | `unlock-password`, `unlock-submit`, `dm-compose`, `send-message` without raw selectors |
| **CC-EVAL-33** preflight warming | **Partial** | Coordination still cold-start blocked; connect used `skipStackPreflight` |
| **CC-EVAL-34** scenario templates | **Works** | `client_scenario_template_catalog` — 4 templates including dual DM + O-4 |
| `client_validate_assert` | **Works** | Round-trip textVisible asserts auto-capture on failure path |
| O-4 edge auto-correct | **Works** | `n22-round18-o4-send` → corrected to `n22-round18-codactrl-send-success` |
| Dual DM round-trip | **Works** | `DM-round20-codactrl-t1/t2-072T1609` asserted both profiles |
| O-4 group send | **Works** | `O4-round20-codactrl-072T1611` + `publishGroupEvent` `:7000` |
| Export bundle coherence | **Works** | `coherent: true`, 10 artifacts |
| `chat-tab` stepLabel | **Gap** | Timeout on `button:has-text("Chat").nth(1)` when already on thread |

**CodaCtrl backlog from round20:** Repair or auto-correct legacy DM chain edge `n6-round16-dual-profile-dm`; add `group-tab` / `open-group-thread` stepLabels; trim `repro.sessions` to round-active pair; coordination warm poll in preflight.

**Maintainer eval doc:** `codactrl/docs/studio/evidence/obscur-rounds-17-19-evaluation-2026-07.md` (round 20 section appended).

---

## Validated in round 21 (2026-07-02 — issue tracking + COM-RUN dual-window)

Round label: `2026-07-02-codactrl-round21` · Sessions `csess-6f1a35b7762b` + `csess-b91e16538053` · Export `20260702162046`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Full stack preflight | **Works** | All 7 checks green including dual `:9231` |
| `client_issue_create` + chain link | **Works** | 4 rows filed with `symptomId`, `trackerStep`, evidence refs |
| COM-RUN-01 dual-window capture | **Works** | T1 participants Tester1-only; T2 Group sidebar empty — **t4 proof** |
| COM-RUN-11 blocked documentation | **Works** | Explicit blocked row + chain node n27 |
| group-room-key-missing capture | **Works** | Sidebar warning vs prior O-4 send success |
| Chain append + screenshots | **Works** | n24/n25/n27 with `transportEvidence` on T2 node |
| O-4 chain integrity | **Fixed** | 27 nodes → `chain-integrity.json` `coherent: true` |
| Export bundle coherence | **Works** | `coherent: true` |
| Rollup primary evidence bump | **Works** | `community-roster-divergence` → T2 round21 capture |
| Chain edge race on rapid append | **Gap** | n25/n27 `edgeCorrected` to n23 — manifest lag between sequential appends |

**CodaCtrl backlog from round21:** Batch chain append API or manifest fsync before edge validation; `open-group-thread` / `community-info` stepLabels; COM-RUN-11 fresh-invite scenario template; one-shot DM chain edge repair migration.

**Ledger investigation (2026-07-02):** [`specs/backend/groups-ledger-validation-investigation-2026-07.md`](../../specs/backend/groups-ledger-validation-investigation-2026-07.md) — production load logs migration need but **never calls** `migrateLedgerEntries()`; 18/20 invalid on Tester1; validator/status mismatch on `historical` rows.

**COM-RUN-11 fixture charter:** [`docs/program/com-run-11-fixture-setup-2026-07.md`](./com-run-11-fixture-setup-2026-07.md) — purge both profiles → recreate NewTest 2 → fresh invite → t4 role matrix (round 22).

## Validated in round 22 (2026-07-04 — Phase 1B exit + Phase 1C baseline)

Round label: `2026-07-04-phase1b-exit-phase1c-baseline` · Session `csess-2527774254b5` · captures `cap-bd27199e32b5` … `cap-944102222a10`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| `client_session_connect` `cdpPort: 9230` | **Works** | Attach to live Tauri after Studio Debug Desk showed 0 targets |
| `client_interact_*` unlock path | **Works** | Profile picker → sign-in → `unlock-submit` → messenger shell |
| `client_runtime_digest_pull` post-unlock | **Works** | `invalidEntries: 0` · `groups.coordination_room_key_*` keys present in digest schema |
| NewTest 2 L3 evidence in thread | **Works** | Four `phase1b-slice-c-l3-*` bubbles visible in snapshot |
| Debug Desk generic CDP scan | **Gap** | Studio UI: "Scan: 0 CDP target(s)" + **cdp not ready yet** while `:9230` is live |
| Multi-Window desk port hint | **Gap** | Shows **CDP port 3000 not listening** — Obscur Tauri uses **9230** (false alarm) |
| Trace guidance symptom bucket | **Stale** | "Investigate: Ledger validation" promoted while digest reports `invalidEntries: 0` |
| Fault title on clean digest | **Noisy** | `fault-dbc61eef` titled `delete_for_everyone_remote_result — count=149` with `symptomIds: []` |
| `signalsExtract` ledger pass | **Gap** | `groups.membership_ledger_load` + `invalidEntries: 0` not promoted as green signal / chain close |

**CodaCtrl backlog from round22:**

1. Debug Desk default scan should probe **9230 → 9231 → 9222** (not 3000) and surface "Tauri CDP found" vs "no subject app".
2. When digest `invalidEntries === 0` and no `room_key_missing_send_blocked`, downgrade or auto-close `groups-ledger-validation` trace guidance.
3. Fault import: prefer symptom-mapped titles; when `symptomIds` empty and digest healthy, label `_(clean baseline)_` not highest-count warn event.
4. Studio Multi-Window row should read `cdpPort` from last successful `client.session.connect` manifest, not hardcoded 3000.

**Obscur product note:** Phase 1B Slice C L3 complete; static shell rebuild picked up digest config + fixture TS fix. Stack: coordination `:8787` · relay `:7000` · shell `:1430`.

## Validated in round 23 (2026-07-04 — Phase 1C O-2 t4 cold restart)

Round label: `2026-07-04-phase1c-o2-t4` · Chain `chain-o2-cold-restart-phase1c-2026-07-04`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Full O-2 t4 chain (send → kill → relaunch → assert) | **Works** | `client_investigation_chain_append` captured pre/post nodes with transport eventId |
| `client_validate_assert` textVisible | **Works** | Pre- and post-restart asserts passed |
| Selector `text={sidebarPreview}` for open-dm-thread | **Works** | `text=O2-phase1c-coldrestart-070T0559` — avoid `button:has-text('Tester2')` (timeout) |
| `open-dm-thread` stepLabel without threadPreview param | **Gap** | Daemon 15s timeout; needs explicit `selector` or `threadPreview` arg on tool |
| Cold kill + tauri dev parent | **Gap** | `taskkill` killed app; `tauri dev` exited code 1 — agent had to restart whole stack manually |
| MCP tool latency on unlock hydrate | **Slow** | Unlock click returns 769 console lines; consider digest pull defer or console cap for agent speed |
| Chain transportEvidence on post node | **Good** | `168d95740472995d` linked across n0/n1 — strong t4 proof |
| `client_issue_create` status=fixed for verified pass | **Works** | Register row `10ae33ad355320dc` at trackerStep 6 |

**CodaCtrl backlog from round23:**

1. **`client_cold_restart` scenario tool** — wrap taskkill → wait CDP → reconnect → optional password unlock recipe (tauri dev survival or detach).
2. **`open-dm-thread` stepLabel** — accept `threadPreview` string param instead of requiring raw `selector`.
3. **Post-interact console cap** — truncate console.jsonl preview for unlock/hydrate steps (agent doesn't need 800 lines).
4. **Auto-close O-2 chain verdict** when n0+n1 both assert same message text + matching eventId in transportEvidence.
5. **Stack resilience** — document that killing exe under `tauri dev` may kill parent; prefer `desktop.titleBar.lock` + relaunch or sidecar restart script.

## Validated in round 24 (2026-07-04 — Phase 1C COM-RUN-11 partial dual-profile)

Round label: `2026-07-04-phase1c-com-run-11-partial` · Chain `chain-com-run-11-phase1c-2026-07-04`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Dual CDP attach `:9230` + `:9231` | **Works** | `openProfileSlot(2)` · sessions `csess-737a8dd7b94f` / `csess-59def28c0bce` |
| Group sidebar navigation | **Works** | `role=button[name="N NewTest 2 No messages yet 22d ago"]` — avoid bare `text=NewTest 2` (strict mode) |
| T1 group compose + send | **Works** | `dm-compose` stepLabel + `role=button[name="Send"]` |
| T2 textVisible assert (receive) | **Fails correctly** | Message absent after 30s+; auto-issue disabled for probe |
| T2 group send | **Blocked (product)** | `groups.room_key_missing_send_blocked` · coordination `wrap_not_found` |
| `client_investigation_chain_append` | **Works** | Node `n1-t1-send-t2-no-key` + digest ref `fault-90f591d2` |
| `client_issue_create` for partial | **Works** | `verify:issue:agent:3aa8584ac1e8095f` · p1 open |
| `focusWindow` via bridge | **Works** | `profile-profile-2-*` label from `listWindows` |
| COM-RUN-11 invite matrix | **Blocked** | Stale fixture — charter purge required before Accept/Cancel t4 |

**CodaCtrl backlog from round24:**

1. **`group-tab` / `open-group-thread` stepLabels** — mirror `dm-compose` with `groupName` param (sidebar row aria names include preview + timestamp).
2. **`client_validate_assert` waitMs** — optional poll window for relay delivery (default assert timeout too short for dual-profile soak).
3. **Dual-session multiwindow capture** — single tool to assert same message text on two sessionIds after send.
4. **Digest green signal** — promote `groups.coordination_room_key_materialized` as pass counter when present post-resolve.
5. **Fixture pubkey helper** — MCP preflight should read live `publicKeySuffix` from attached session before coordination steward-wrap scripts.

**Obscur product note:** v2 community `v2_c32217ec…` has Tester1 wraps only; profile-2 needs purge + fresh invite + steward wrap under live Tester2 pubkey before row 2 t4 can close.

## Validated in round 25 (2026-07-04 — Phase 1C COM-RUN-11 t4 dual-profile)

Round label: `2026-07-04-phase1c-com-run-11-t4` · Chain `chain-com-run-11-phase1c-2026-07-04`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Nuclear purge + key re-import | **Works (partial baseline)** | Relay backup still rehydrates NewTest 2 on unlock — charter gap |
| `client_session_connect` + `skipStackPreflight` | **Works** | Required when `:9230` not in preflight probe plan |
| Fresh invite → T2 Accept+Decline | **Works** | inviteId `b4683d19…` · roomKey in DM wrap payload |
| T2 invite accept | **Works** | Group 1 badge · 2 members on group thread |
| T1 group send + T2 textVisible | **Works (t4)** | `COM-RUN-11-phase1c-round25-070T0540` · eventId `e2cd1ced…a5d3f036` |
| `client_validate_assert` textVisible | **Works** | 3s relay soak sufficient this run |
| `client_investigation_chain_append` | **Works** | `n2-fresh-invite-accept` · `n3-dual-send-t4` |
| `client_issue_update` status=fixed | **Works** | Closed `3aa8584ac1e8095f` after t4 pass |
| T1 inviter Cancel assert | **Deferred** | Accept executed before Cancel capture; retry on next pending invite |

**CodaCtrl backlog from round25:**

1. **Relay-side fixture purge helper** — MCP or script to wipe encrypted account backup on relay before COM-RUN-11 matrix.
2. **Invite matrix recipe** — ordered steps: T1 Cancel assert → T2 Accept/Decline assert → accept → dual send (prevent accept-before-Cancel race).
3. **Group sidebar selector helper** — parametrize preview text (`Joined private encrypted group` vs `No messages yet`).
4. **Chain edge ordering** — parallel append calls can race; second node may miss `edgeFromNodeId` if first not flushed.

**Obscur product note:** Fresh invite with roomKey in DM gift-wrap unblocks profile-2 without coordination steward wrap when invitee accepts; nuclear local purge alone does not clear relay-backed membership/history.

## Validated in round 26 (2026-07-04 — CodaCtrl preflight CDP fix)

Round label: `2026-07-04-codactrl-preflight-cdp-fix`

| Fix | Status | Notes |
|-----|--------|-------|
| Repo `client.cdp.yaml` | **Landed** | `profileCdpPorts: [9230,9231,9229]` · `excludeProbePorts: [9222]` · `devServerPorts` includes `:7000` |
| `scopeMode: subject-app` | **Works** | Was `generic` — preflight probed `:9229` not `:9230` |
| `cdpTargetCount` / `cdpNotReady` | **Fixed** | Was `0` / `true` while `:9230` live |
| `client_stack_preflight` CDP checks | **Pass** | Fails only on relay `:7000` when Docker down (expected) |
| codactrl `resolve_client_cdp_profile` | **Patched** | Auto-detect Obscur via `verify-profile-picker-flow.mjs` |
| `skipStackPreflight` workaround | **No longer required** for CDP | Still needed only when relay/coordination intentionally partial |

**Remaining env gaps:** Docker Desktop off → `pnpm dev:relay:docker` required for `:7000`; desktop `exit code 1` after dual-profile boot (intermittent, separate track).

## Validated in rounds 27–30 (2026-07-04 — Phase 1C exit)

Round labels: `phase1c-docker-relay` (r27) · `com-run11-invite-matrix` (r28) · `k-m1-leave-partial` (r29) · `k-m2-rejoin-t4` (r30) · Chain `chain-com-run-11-phase1c-2026-07-04`

| Shipped primitive | Status | Notes |
|-------------------|--------|-------|
| Docker relay dual send after stack restart | **Works (t4)** | T2 needed **Apply operator bundle** when `1/6` relays · `n4-docker-relay-dual-send` |
| COM-RUN-11 invite role matrix | **Works (t4)** | T1 **Cancel** · T2 **Accept** + **Decline** on live card before accept · `n5-com-run11-invite-matrix` |
| Coordination membership API | **Works** | Full `communityId` must include relay suffix (`…:ws%3A%2F%2Flocalhost%3A7000`) |
| K-M1 leave coordination delta | **Works** | `leave` seq 3 published; T1 reconcile applied 3 updates |
| K-M1 excluded roster UI (T1) | **Fails (product)** | Participants modal: Tester1 only — **Excluded from active roster** absent · COM-RUN-01 PAUSED |
| K-M2 re-invite Accept | **Works (t4)** | Pending invite from r28 · coord `join` seq 4 |
| Post-rejoin dual send/receive | **Works (t4)** | `COM-RUN-11-phase1c-rejoin-070T0746` · T2 `2 members · 2 online` · `n7-k-m2-rejoin-t4` |
| T2 sidebar click flake | **Gap** | Clicks timeout when window unfocused; `client_validate_assert` can surface group thread without click |
| Participants modal z-[140] overlay | **Gap** | Blocks **Enter Community Chat** / **Manage** until close button clicked |

**CodaCtrl backlog from rounds27–30:**

1. **Coordination URL helper** — MCP preflight should emit encoded `communityId` for curl/deltas probes.
2. **Participants modal dismiss** — `close-participants-modal` stepLabel for group home overlay.
3. **T2 focus-before-click** — auto `focusWindow(profile-2)` before `client_interact_click` on `:9231`.
4. **K-M1 verdict split** — chain node should tag coordination-pass vs UI-fail separately (done: `n6` / `n7`).

**Obscur product note:** Phase 1C **exit** with row 3 **A** and row 4 split: membership mutation + re-invite path proven t4; roster display divergence tracked under COM-RUN-01 integration study.

---

## Executive summary

MCP-driven capture on live Obscur **worked** for unlock, console export, M0 digest pull, screenshots, and structured issue filing. The highest-value CodaCtrl gaps are:

1. **CDP port contract** — Obscur uses **9230**; Studio uses **9222**; verify scripts and auto-probe logic collide.
2. **Verify scenario false outcomes** — `obscur-profile-picker-flow` fails on mocked shell or wrong port while MCP golden path passes.
3. **`workspaceAligned` / daemon `repoRoot`** — MCP calls fail with `fetch failed` when `codactrld` serves the wrong repo.
4. **Multi-window** — health finding `multi-window-single-cdp-target` is correct; dual-window tests need abort gate + WebDriver path.
5. **Runtime digest pipeline** — `client_runtime_digest_pull` is the right abstraction; extend symptom mapping and M0 focus categories.

---

## What worked well (keep / extend)

| Capability | Tool | Proof |
|------------|------|-------|
| Live WebView attach | `client_session_connect` @ CDP 9230 | Sessions `csess-f2191e90e578`, `csess-d0e975bc8b08`, `csess-56331621b1d9` |
| In-app navigation | `client_interact_click` on sidebar links | Avoids SPA reload drop from `client_navigate` |
| Structured runtime export | `client_runtime_digest_pull` | Faults `fault-6a3f1d6c`, `fault-6e8f7e13`, `fault-527da80b` |
| Issue filing with evidence | `client_issue_create` | 7 agent issues + scenario row in register |
| Environment preflight | `client_dev_environment_get` | `workspaceAligned`, `profileCdpPorts`, listener matrix |
| Health triage | `client_runtime_health_scan` | `multi-window-single-cdp-target` finding |
| Golden path doc | `client_workflow_guide` → `obscurGoldenPath` | Prerequisites + agent pitfalls |

**Recommended:** Treat `client_runtime_digest_pull` + `client_issue_create` as the canonical **runtime issue capture** path (RIW-8). Clicks complement; they do not replace digest export.

---

## Priority improvements for CodaCtrl

### P0 — Daemon workspace alignment

**Observed:** `client_session_connect` returned `fetch failed` when `codactrld` had `repoRoot` pointing at a different workspace (`strata` vs `newstart`).

**Fix / harden:**

- `client_dev_environment_get` should surface `workspaceAligned: false` as a **blocking** preflight before attach.
- Document: restart daemon from subject repo:  
  `CLIENT_CAPTURE_MODE=playwright codactrld serve` from Obscur root.
- Health response already exposes `repoRoot` — agents should abort when misaligned.

---

### P0 — CDP port contract (9230 vs 9222)

| Port | Typical owner | Used by |
|------|---------------|---------|
| **9230** | Obscur Tauri (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230`) | MCP golden path, successful captures |
| **9222** | CodaCtrl Studio Vite | Wrong target if probed first |
| **9231** | Second Obscur profile window (not up in tests) | Multi-window stretch |
| **4445** | Tauri WebDriver (not enabled in Obscur) | Multi-window fallback |

**Observed failures:**

- `verify-profile-picker-flow.mjs` auto-detects **9222 only** → attaches to Studio → `No Obscur page on CDP`.
- Script header still documents port **9222**; MCP documents **9230**.

**Fix / harden:**

1. **`client.cdp.yaml` `profileCdpPorts`:** `9230 → 9231 → 9229` — never default to 9222 for subject-app scope.
2. **`client_session_connect`:** When multiple CDP ports are open, prefer `profileCdpPorts` over generic `9222`.
3. **Verify scenarios:** Probe `profileCdpPorts` from repo config; require explicit `--cdp` or env `OBSCUR_CDP_PORT=9230`.
4. **Workflow guide:** Single canonical launch line for Obscur CDP (9230), separate Studio port called out as out-of-scope.

---

### P1 — Verify scenario hygiene (`obscur-profile-picker-flow`)

**Scenario ID:** `obscur-profile-picker-flow`  
**Script:** `scripts/verify-profile-picker-flow.mjs`  
**Issue:** `verify:issue:scenario:obscur-profile-picker-flow` (p1)

#### Pass/fail matrix (2026-07-01)

| # | CDP state | `appBase` | Result | Failure class |
|---|-----------|-----------|--------|---------------|
| A | Unavailable | `:3341` static shell | **FAIL** | Picker grid not shown (`vrun-31d8d75b`) |
| B | `:9222` Studio | `:3341` | **FAIL** | No Obscur page |
| C | `:9230` Obscur | `:3341` default | **FAIL** | `goto :3341/profiles` CONNECTION_REFUSED |
| D | `:9230` Obscur | `OBSCUR_APP_BASE=:1430` | **FAIL** | Intermittent Playwright CDP attach |
| E | `:9230` MCP clicks | n/a | **PASS** | Tester1 unlock (RIW-1) |

#### Root causes

1. Port collision (9222 vs 9230).
2. **`OBSCUR_APP_BASE` default `:3341`** — live Tauri static asset server is **`:1430`**.
3. Mocked static shell renders `PROFILES` header but not `Who's using Obscur?` — false-negative.
4. **False-green:** `fileExists` + `fileContains` pass while `scriptInvoke` fails.

#### Recommended scenario behavior

| Change | Rationale |
|--------|-----------|
| **`skip`** when no Obscur CDP on `profileCdpPorts` | Avoid mocked-shell false failure |
| Default `OBSCUR_APP_BASE=http://127.0.0.1:1430` for Tauri | Fix CONNECTION_REFUSED |
| Do not treat mocked shell as **t3** proof | Tier t2 at best |
| Align preflight with `obscurGoldenPath` | Same WEBVIEW2 args as MCP |
| Split scenario steps: static (t1) vs live CDP (t3) | Clear proof tiers in manifest |

**Artifacts:** `.codectx/verify/artifacts/riw-6-profile-picker-pass-fail-matrix-2026-07-01.md`

---

### P1 — Multi-window attach (RIW-7)

**Issue:** `verify:issue:agent:ea000f3b3f41603b` · `multi-window-single-cdp-target`

**Observed:**

- Second native Tauri window opens (profile slot).
- CDP `json/list` on 9230 shows **1 page** only.
- Ports **9231** and **4445** not listening.
- Health scan correctly emits `multi-window-single-cdp-target` (medium).

**CodaCtrl actions:**

- Abort dual-window test plans when health finding present (already in workflow guide v1.4+).
- Document stretch goals: per-profile CDP port or `tauri-plugin-wdio-webdriver` on :4445.
- `client_session_list_webdriver_targets` when WebDriver ships in Obscur.

---

### P2 — MCP agent pitfalls (document + enforce in tools)

Captured during live sessions — add to workflow guide and optionally lint in MCP responses:

| Pitfall | Correct approach |
|---------|------------------|
| `client_navigate` on SPA (`:1430`) | **Sidebar link clicks** — full reload drops CDP attach |
| Assert param name | Use `assertKind` (not `assertion` alone) |
| Lock dialog confirm | Selector `[role="dialog"] >> button >> text="Lock"` (bare `dialog >> button` times out) |
| Nested profile picker buttons | Use Chats link to return; avoid deep nested clicks |
| `client_console_latest` on new session | Unlock timeline lives in earlier `console.jsonl` on same Obscur instance — pull digest for full history |
| Digest after native lock | `keychainPreserved: true` lock keeps UI visible; digest may show `identityStatus: locked` |

---

### P2 — Runtime digest → issue automation (RIW-8)

**Shipped pipeline (works):**

```
client_runtime_digest_pull
  → obscurM0Triage.captureJson() in-page
  → verify.fault.import
  → .codectx/verify/faults/fault-*.json
client_issue_create
  → .codectx/verify/issues-register.json
```

**Gaps to close in CodaCtrl:**

| Gap | Recommendation |
|-----|----------------|
| `symptomIds` empty on imported faults | Map known `logAppEvent.name` → `symptomId` at import time |
| M0 focus missing ledger events | Add `groups.ledger_validation_issues` to `sync_restore` focus |
| No dedupe on re-import | Dedupe key: `symptomId` + `profileId` + day + context hash |
| `client_issue_update` | Could not triage `verify:issue:scenario:*` — support scenario issue updates |
| Proof tier on faults | Auto-set `t3` when source is live CDP session |

#### Event → symptomId mapping (for auto-issue)

| `logAppEvent.name` | symptomId | Severity | When |
|--------------------|-----------|----------|------|
| `groups.ledger_validation_issues` | `groups-ledger-validation` | p1 | always |
| `groups.ledger_migration_needed` | `groups-ledger-migration-stall` | p2 | repeated without invalid count drop |
| `messaging.conversation_list_authority_selected` | `projection-authority-not-ready` | p2 | `projectionReadAuthorityReason: projection_not_ready` |
| `network.peer_trust_read_authority_selected` | `projection-authority-not-ready` | p2 | `holdReason: projection_empty_legacy_nonempty` |
| `account_projection.replay_complete` | `projection-replay-drifted` | p2 | `driftStatus: drifted` |
| `messaging.dm_normalize_is_outgoing_mismatch` | `dm-normalize-outgoing-mismatch` | p2 | always |
| `messaging.transport.sync_timing` | `messaging-sync-timeout` | p2 | `timed_out` |
| `requestfailed` @ `:8787` … `/membership/deltas` | `coordination-membership-deltas-unreachable` | p2 | REFUSED or CORS |

#### Draft export schema (Obscur → CodaCtrl ingest)

```json
{
  "schema": "obscur.runtime.issue.v1",
  "symptomId": "groups-ledger-validation",
  "severity": "p1",
  "sourceEvent": "groups.ledger_validation_issues",
  "capturedAtUnixMs": 0,
  "profileId": "default",
  "context": {},
  "digestRef": "obscur.m0.capture.v1",
  "proofTier": "t3"
}
```

Target ingest path: `.codectx/verify/runtime-captures/` or extend `verify.fault.import`.

---

### P3 — Dev stack awareness in health scan

**Observed console patterns** that health scan could bucket (not Obscur bugs):

| Pattern | Stack | Suggested finding |
|---------|-------|-----------------|
| `ERR_CONNECTION_REFUSED` @ `:8787` | Desktop-only | `coordination-not-running` (info) |
| `ERR_CONNECTION_REFUSED` @ `localhost:7000` | No team relay | `team-relay-not-running` (info) |
| `wss://relay.internal` reset | Partial stack | `internal-relay-unavailable` (info) |
| CORS @ `:8787` with wrangler up | Discrepancy | `coordination-cors-browser-mismatch` (investigate) |

Desktop-only relay partial stack is **expected** — DM sync still completed (`eose_quorum_reached`, 357 ms). Classify as **environment**, not product failure.

---

## Obscur runtime findings (context for capture agents)

These are **Obscur product issues** filed via CodaCtrl — useful for knowing what events to watch and what repro steps matter.

### Error chain (capture order)

```
Unlock → ledger validation (18/20 invalid)
      → projection authority (sqlite, projection empty, drifted)
      → DM normalize mismatches (symptom)
      → background :8787 delta poll failures (infra)
```

### RIW-1 — Membership ledger (p1)

| Field | Value |
|-------|--------|
| Issue | `verify:issue:agent:0c914a5d3cb0912d` |
| Events | `groups.ledger_validation_issues`, `groups.ledger_migration_needed` |
| invalidEntries / total | **18 / 20** (stable across sessions) |
| needsMigrationCount | **9** (logged repeatedly; no repair evidence) |
| Sample groups | `b93f53e2…` missing `publicKeyHex`; `f83e5449…` CRITICAL missing `memberPubkeys` |
| Session | `csess-f2191e90e578` |
| Fault | `fault-6a3f1d6c` |

### RIW-2 — Projection authority (p2)

| Field | Value |
|-------|--------|
| Issue | `verify:issue:agent:7a3d72a85a8e1c35` |
| projectionConversationCount vs sqlite | **0 vs 2** (entire unlock window) |
| projectionPeerCount vs stored | **0 vs 1** |
| replay driftStatus | **`drifted`** (95 → 99 events) |
| criticalDriftCount | **0 → 1** after first replay |
| Authority vs EOSE | Warnings **~43 ms** after ledger load; EOSE **~3 s** later |
| Fault | `fault-6e8f7e13` |

### RIW-3 — DM normalize (p2)

| Field | Value |
|-------|--------|
| Issue | `verify:issue:agent:df96c6996e0512a9` |
| Digest count | **36** events; **6** unique messages |
| Conversation | Tester2 DM only |
| UI impact | Labels appear correct on screenshot |
| Timing | **~404 ms** after ledger validation |

### RIW-4 — Coordination deltas (p2)

| Field | Value |
|-------|--------|
| Issue | `verify:issue:agent:fe1556fff6a7792e` |
| Desktop-only | **19×** CONNECTION_REFUSED @ `:8787` |
| Prior full-stack | **28×** browser CORS blocks (`csess-5c26475ea529`) |
| curl with wrangler up | `Access-Control-Allow-Origin: *` present — **discrepancy** vs browser CORS session |
| User impact | Background delta poll only |

### RIW-5 — Relay stack (p3, dev-env)

| Field | Value |
|-------|--------|
| Issue | `verify:issue:agent:fd6bb614119ce9f2` |
| UI | 1/6 active relays |
| Local failures | `:7000` refused; `relay.internal` reset |
| DM sync | Completed, no timeout |
| Fault | `fault-527da80b` |

---

## Evidence inventory

### Client sessions (primary)

| Session | Role |
|---------|------|
| `csess-f2191e90e578` | Tester1 unlock — ledger, authority, DM console timeline |
| `csess-d0e975bc8b08` | Daemon re-attach; screenshots; warm digest |
| `csess-56331621b1d9` | RIW-5 relay digest pull |
| `csess-5c26475ea529` | 2026-06-30 baseline; CORS @ 8787; multi-window |

Base path: `.codectx/verify/client-sessions/<csess-id>/`

### Runtime faults (M0 digests)

| Fault ID | Capture |
|----------|---------|
| `fault-6a3f1d6c` | RIW-1 unlock digest |
| `fault-6e8f7e13` | RIW-2 projection authority |
| `fault-527da80b` | RIW-5 relay snapshot |

Path: `.codectx/verify/faults/`

### Verify runs (scenario)

| Run | Result |
|-----|--------|
| `vrun-31d8d75b` | scriptInvoke fail — mocked shell picker missing |
| `vrun-acd02d38` | scriptInvoke timeout (30s) |

Paths: `.codectx/verify/runs/` and `.codactrl/verify/runs/`

### Artifacts

| File | Content |
|------|---------|
| `riw-6-profile-picker-pass-fail-matrix-2026-07-01.md` | Scenario matrix |
| `riw-4-curl-cors-probe-2026-07-01.txt` | Coordination CORS curl output |
| `riw-6-profile-picker-cdp-*.txt` | Script stdout per CDP condition |

Path: `.codectx/verify/artifacts/`

### Issues register

Path: `.codectx/verify/issues-register.json` — **10 rows** (7 agent + 3 fault/scenario imports)

---

## Recommended CodaCtrl roadmap

| Phase | Item | Outcome |
|-------|------|---------|
| **1** | Harden `workspaceAligned` gate + daemon docs | No silent `fetch failed` |
| **1** | Fix CDP probe order (9230 before 9222) in connect + verify | No Studio mis-attach |
| **2** | Scenario `skip` when no subject CDP; fix `OBSCUR_APP_BASE` default | Fewer false-red runs |
| **2** | `verify.fault.import` symptomId mapping table | Auto-triage digests |
| **3** | Health scan dev-stack buckets (`8787`, `7000`) | Separate env vs product |
| **3** | `client_issue_update` for scenario issues | Triage workflow complete |
| **4** | Ingest `obscur.runtime.issue.v1` from Obscur settings export | RIW-8 product loop |
| **4** | WebDriver multi-window path when Obscur ships `:4445` | RIW-7 unblock |

---

## Dev environment reference (Obscur + CodaCtrl)

### Launch Obscur with MCP CDP

```bash
export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9230"
pnpm dev:desktop -- --online --skip-build
```

### Launch codactrld (from Obscur repo root)

```bash
CLIENT_CAPTURE_MODE=playwright codactrld serve
# Health: http://127.0.0.1:46231/health → repoRoot must match workspace
```

### Port map

| Port | Service |
|------|---------|
| 9230 | Obscur CDP (subject app) |
| 9222 | CodaCtrl Studio (exclude from subject probe) |
| 1430 | Tauri asset / PWA shell |
| 3341 | Static verify shell (mocked scenarios) |
| 46231 | codactrld |
| 8787 | Coordination wrangler (optional) |
| 7000 | Team relay (optional) |
| 4445 | Tauri WebDriver (not enabled) |

### MCP golden path (minimal)

1. `client_dev_environment_get` — confirm `workspaceAligned: true`
2. `client_session_connect` `{ cdpPort: 9230 }`
3. `client_interact_click` — sidebar navigation
4. `client_runtime_digest_pull` — before cold restart
5. `client_issue_create` — link `evidenceRefs` + `linkCaptureId`

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-01 | Initial compile from RIW-1–8 capture charter + issues register + artifacts |
