# Agent handoff — interactive observe round

Exported at: `2026-07-02T16:11:59.722218600+00:00`

## Operator round

- round label: 2026-07-02-codactrl-round20
- confirmed by: codactrl-round20-agent
- notes: Dual-profile round 20: csess-6f1a35b7762b (T1 :9230) + csess-b91e16538053 (T2 :9231). DM-round20-codactrl-t1/t2-072T1609 round-trip asserted. O4-round20-codactrl-072T1611 visible + publishGroupEvent :7000. Coordination intermittently refused during unlock.
- agent export at: 2026-07-02T16:11:59.722218600+00:00
- operator export at: 2026-07-02T16:11:59.722218600+00:00

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

