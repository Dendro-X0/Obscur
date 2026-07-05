# Agent handoff — interactive observe round

Exported at: `2026-07-04T14:15:18.761862900+00:00`

## Operator round

- round label: 2026-07-04-r1-room-key-health-t4
- confirmed by: agent
- notes: R1 health hook uses resolveRoomKeyHexForMembershipHealthPanel; warm send + cold restart on NewTest 2
- agent export at: 2026-07-04T14:15:18.761862900+00:00
- operator export at: 2026-07-04T14:15:18.761862900+00:00

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

- issues: **35**
- investigation chains: **6**
- MCP audit entries: **500**

Operator exported via Studio Monitor → Confirm round. Hub sync materializes `.codactrl/verify/` mirrors for agents.

