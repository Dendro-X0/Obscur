# Agent handoff — interactive observe round

Exported at: `2026-07-02T14:45:47.775846600+00:00`

## Operator round

- round label: 2026-07-02-codactrl-round18
- confirmed by: agent-mcp-round18
- notes: Round18 post CodaCtrl upgrade: O4 O4-round18-codactrl-072T1445 send success; Docker :7000; coord cold-start blocked preflight; skipStackPreflight; profile-2 on :9231; n22 chain node
- agent export at: 2026-07-02T14:45:47.775846600+00:00
- operator export at: 2026-07-02T14:45:47.775846600+00:00

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

