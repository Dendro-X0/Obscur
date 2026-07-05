# Agent handoff — interactive observe round

Exported at: `2026-07-02T16:20:46.702791700+00:00`

## Operator round

- round label: 2026-07-02-codactrl-round21
- confirmed by: codactrl-round21-agent
- notes: Round21 issue-tracking pass: full stack preflight green. COM-RUN-01 t4 dual-window — T1 participants Tester1-only (knownParticipantCount=0); T2 Group sidebar empty. group-room-key-missing sidebar vs O4 send. COM-RUN-11 blocked (historical invite cards). Chain nodes n24/n25/n27 on chain-o4-group-ingest. Issues: 8fc30833846c694c, 64baee5012722dfa, e10f184afe997a07, ac194ae60fbc0bd2.
- agent export at: 2026-07-02T16:20:46.702791700+00:00
- operator export at: 2026-07-02T16:20:46.702791700+00:00

## Read first

1. `.codactrl/verify/issue-report/export-manifest.json`
2. `.codactrl/verify/issue-report/report-rollup.md`
3. `.codactrl/verify/issue-report/meta-chain.json`
4. `.codactrl/verify/issue-report/report-lite.json`
5. `.codectx/verify/issues-register.summary.json`
6. One chain manifest under `.codectx/verify/chains/<chainId>/manifest.json`

## MCP tools (live session)

- `verify_workflow_guide` — interactive observe round steps
- `verify_dogfood_preflight` — workspace + boot artifact checks
- `verify_agent_boot_status` — after operator export + hub sync
- `verify_issues_list` with `sinceEtag` for incremental updates
- `client_dev_environment_get` → `client_session_connect` (CDP 9230) → `client_runtime_digest_pull` / `client_investigation_chain_append`

## Avoid

- `issue-report/report.json` (operators/debug only)
- `mcp-history/audit.jsonl` (unless debugging export gaps)

## Counts

- issues: **15**
- investigation chains: **3**
- MCP audit entries: **500**

Operator exported via Studio Monitor → Confirm round. Hub sync materializes `.codactrl/verify/` mirrors for agents.

