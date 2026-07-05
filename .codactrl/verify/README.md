# Verify reports

Studio Output Hub — materialized artifacts for IDE and agent navigation.

- **False-green scan** — [`.codactrl/verify/agent/false-green.json`](.codactrl/verify/agent/false-green.json)
  - source: `.codectx/verify/false-green.json`
- **Verify agent entrypoints** — [`.codactrl/verify/agent/entrypoints.json`](.codactrl/verify/agent/entrypoints.json)
- **Verify latest pass** — [`.codactrl/verify/latest-pass.json`](.codactrl/verify/latest-pass.json)
  - source: `.codectx/verify/latest-pass.json`
- **Verify latest run** — [`.codactrl/verify/latest-run.json`](.codactrl/verify/latest-run.json)
  - source: `.codectx/verify/latest-run.json`
- **Verify run manifest (vrun-31d8d75b)** — [`.codactrl/verify/runs/vrun-31d8d75b/manifest.json`](.codactrl/verify/runs/vrun-31d8d75b/manifest.json)
  - source: `.codectx/verify/runs/vrun-31d8d75b/manifest.json`
- **Verify scenario results (vrun-31d8d75b)** — [`.codactrl/verify/runs/vrun-31d8d75b/scenario-results.json`](.codactrl/verify/runs/vrun-31d8d75b/scenario-results.json)
  - source: `.codectx/verify/runs/vrun-31d8d75b/scenario-results.json`
- **Verify summary** — [`.codactrl/verify/summary.md`](.codactrl/verify/summary.md)
- **Issues register summary** — [`.codactrl/verify/issues-register.summary.json`](.codactrl/verify/issues-register.summary.json)
  - source: `.codectx/verify/issues-register.summary.json`
- **Verify hub index** — [`.codactrl/verify/index.json`](.codactrl/verify/index.json)
- **Verify MCP audit log** — [`.codactrl/verify/mcp-history/audit.jsonl`](.codactrl/verify/mcp-history/audit.jsonl)
- **Verify MCP history summary** — [`.codactrl/verify/mcp-history/summary.json`](.codactrl/verify/mcp-history/summary.json)
- **Verify MCP history index** — [`.codactrl/verify/mcp-history/index.json`](.codactrl/verify/mcp-history/index.json)
- **Verify export manifest (JSON)** — [`.codactrl/verify/issue-report/export-manifest.json`](.codactrl/verify/issue-report/export-manifest.json)
- **Verify issue report (JSON)** — [`.codactrl/verify/issue-report/report.json`](.codactrl/verify/issue-report/report.json)
- **Verify issue report lite (JSON)** — [`.codactrl/verify/issue-report/report-lite.json`](.codactrl/verify/issue-report/report-lite.json)
- **Verify issue report (Markdown)** — [`.codactrl/verify/issue-report/report.md`](.codactrl/verify/issue-report/report.md)
- **Verify issue rollup (Markdown)** — [`.codactrl/verify/issue-report/report-rollup.md`](.codactrl/verify/issue-report/report-rollup.md)
- **Verify meta-chain graph (JSON)** — [`.codactrl/verify/issue-report/meta-chain.json`](.codactrl/verify/issue-report/meta-chain.json)
- **Verify agent handoff (Markdown)** — [`.codactrl/verify/issue-report/agent-handoff.md`](.codactrl/verify/issue-report/agent-handoff.md)
- **Verify repro recipe (JSON)** — [`.codactrl/verify/issue-report/repro-recipe.json`](.codactrl/verify/issue-report/repro-recipe.json)
- **Verify repro recipe (Markdown)** — [`.codactrl/verify/issue-report/repro-recipe.md`](.codactrl/verify/issue-report/repro-recipe.md)

## Git policy

- `.codectx/verify/` is machine truth (sessions, faults, chains, register). Keep local or gitignored in subject repos.
- `.codactrl/verify/` mirrors agent navigation. Commit `issue-report/` per pass when sharing evidence with reviewers or agents.
- Prefer agents read `issue-report/report-rollup.md` then `issues-register.summary.json`; avoid full `report.json` and `mcp-audit.jsonl` unless debugging.
- Pass snapshots archive to `.codectx/verify/passes/<date>/` on each `verify.issues.report.export`.
