# CodaCtrl agent runbook — Obscur (2026-07)

**Audience:** Agents and maintainers using `project-0-obscur-codactrl-studio` MCP  
**Findings register:** [codactrl-improvement-findings-2026-07.md](./codactrl-improvement-findings-2026-07.md)  
**FLS rule pack:** [`.codactrl/logic/obscur-fls-rule-pack-v1.json`](../../.codactrl/logic/obscur-fls-rule-pack-v1.json)

---

## Workspace alignment (WEB-R1)

**Symptom:** `client_session_connect { provider: "playwright-chromium", url }` fails with workspace misalignment when `codactrld` was started outside the Obscur repo root.

**Fix:**

1. Stop existing `codactrld` / Studio daemon.
2. `cd` to Obscur monorepo root (directory containing `apps/pwa`, `.codactrl`, `.codectx`).
3. Restart MCP server from Cursor project settings (or maintainer daemon bootstrap).
4. Confirm: `client_dev_environment_get` → `workspaceAligned: true`.

**Workaround until restart:** bootstrap website sessions via `client_snapshot { url, provider: "playwright-chromium" }` (creates session without explicit connect).

---

## Desktop lane (t3/t4)

| Step | Tool | Notes |
|------|------|-------|
| Preflight | `client_dev_environment_get` | `workspaceAligned: true` |
| Connect | `client_session_connect { cdpPort: 9230 }` | Tester1 default |
| Interact | `client_interact_click` with Obscur step labels | `dm-compose`, group tab, etc. |
| Evidence | `client_runtime_digest_pull` | Before/after cold restart |
| Chain | `client_investigation_chain_append` | Link `chainId`, `stepLabel`, `waitMs` |

Second profile: `:9231` or `client_multiwindow_switch`.

---

## Website lane (Phase 4)

**Dev server:** `pnpm -C apps/website dev` → `http://localhost:3000`

| Step | Tool | Notes |
|------|------|-------|
| Bootstrap | `client_snapshot { url, provider: "playwright-chromium" }` | Preferred when connect blocked |
| Navigate | `client_navigate { url }` | Multi-page flows |
| Interact | `client_interact_click { selector }` | Use explicit CSS — e.g. `nav[aria-label="Primary"] a.site-nav-link` |
| Structure | `client_web_surface_probe { sessionId }` | Hero h1, nav count, download links, SHA presence |
| Visual | `client_screenshot_capture` | Chain nodes |

### Verification hooks (WEB-R2 mitigation)

Download page exposes stable probe targets:

| Hook | Location | Purpose |
|------|----------|---------|
| `data-codactrl-surface="download-checksums"` | Checksums section | Section-level surface |
| `data-codactrl-sha256="<hex>"` | Each `<code class="checksum-value">` | SHA-256 row probe |

**DOM verified:** `curl /download` renders `data-codactrl-sha256` on checksum rows (2026-07-05).

**Probe gap (WEB-R2 residual):** `client_web_surface_probe` may still report `downloadShaPresent: false` until CodaCtrl daemon checks `[data-codactrl-sha256]` (not free-text alone). Obscur hooks are landed; daemon wiring is external.

**Chain reference:** `chain-phase4-website-2026-07-04` · symptomClass `phase4-website-editorial`

---

## Signal extract (RIW-8)

Obscur ships proposed mappings in FLS rule pack § `signalExtractMappings`:

| ID | Digest / DOM | Maps to |
|----|--------------|---------|
| `SX-ROOM-KEY-BLOCKER` | `groups.membership_health_snapshot` + `room_key_missing` | `group-room-key-missing` |
| `SX-LEDGER-INVALID` | `groups.ledger_validation_issues` invalidEntries > 0 | `groups-ledger-validation` |
| `SX-LEDGER-LOAD-CLEAN` | `groups.membership_ledger_load` invalidEntries = 0 | pass signal |
| `SX-WEB-DOWNLOAD-SHA` | `[data-codactrl-sha256]` on website | pass signal |

**CodaCtrl repo action:** Wire `signalExtractMappings` into `verify_fault_import` / RIW-8 extractor (not yet consumed by daemon).

---

## Residual gaps (CodaCtrl repo)

| ID | Gap | Obscur mitigation |
|----|-----|-------------------|
| **WEB-R3** | `client_surface_probe` on Playwright sessions returns desktop digest fields | Use `client_web_surface_probe` for website; desktop probe for `:9230` only |
| **WEB-R1** | Connect schema + workspace root | Runbook § workspace alignment |
| **WEB-R2** | `downloadShaPresent` false positive | DOM hooks on `/download` (2026-07-04) |
| **RIW-8** | Empty `signalsExtract` on faults | FLS `signalExtractMappings` draft |

---

## Export discipline

After t4 capture:

1. `verify.issues.report.export` (or Studio export flow)
2. Read `.codactrl/verify/issue-report/report-rollup.md` first
3. Checkpoint handoff when chain closes a repair row

See [`.codactrl/verify/README.md`](../../.codactrl/verify/README.md) for git policy.
