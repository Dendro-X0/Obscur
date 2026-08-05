# CodaCtrl — MCP-first agent surface (Studio UI optional)

**Date:** 2026-07-30  
**Charter:** Agents must complete salvage / verify / capture loops via **Cursor MCP + `codactrld`**, without depending on the Studio desktop client UI.  
**Why:** Studio F5 crash · dual-window harness chips · solo maintainer cannot babysit Monitor. Studio remains a human convenience viewer, not the control plane.  
**Related:** [codactrl-studio-f5-boot-crash-2026-07.md](./codactrl-studio-f5-boot-crash-2026-07.md) · [codactrl-prerefactor-upgrade-requirements-2026-07.md](./codactrl-prerefactor-upgrade-requirements-2026-07.md)

---

## Product rule

| Role | Owns |
|------|------|
| **`codactrld` + MCP** | Scan · connect · digest · chain · issues · export · salvage pathway · freeze/owner · cargo prove · sandbox |
| **Subject app (Obscur)** | Must expose CDP (`:9230`) — human or script launches it |
| **Studio UI** | Optional mirror of daemon state — **never** required for agent proof |
| **CodeGraph** | Optional blast-radius (external MCP) |

**Anti-copy to remove:** Monitor copy *"no Cursor MCP required"* as the golden path. Invert: *"MCP is the agent golden path; Studio is optional."*

---

## Already MCP-complete (dogfood 2026-07-30)

| Studio Monitor step | MCP equivalent | Status |
|---------------------|----------------|--------|
| Workspace aligned | `studio_workspace_binding` · `client_dev_environment_get` | ✓ |
| Scan CDP / listeners | `client_dev_environment_get` · `client_session_list_targets` | ✓ |
| Multi-window desk chips | `client_multiwindow_status` | ✓ (same `:9230`/`:9231` not listening) |
| Salvage pathway | `studio_pathway` | ✓ |
| Owner / freeze / slice | `studio_owner_conflicts_get` · `verify_freeze_set_propose` · `verify_vertical_slice_evaluate` | ✓ |
| Issues register | `verify_issues_list` · `verify_issues_promote` | ✓ |
| **Export report bundle** | `verify_issues_report_export` | ✓ just ran (`confirmedBy: agent`) |
| Boot rollup for agents | `verify_agent_boot_status` · `verify_dogfood_preflight` | ✓ |
| Cargo / ops prove | `verify_operation_run` / `verify_operation_prove` | ✓ (catalog path bugs remain) |
| Interact when CDP up | `client_session_connect` → click/type/digest/assert | ✓ API present |

**Implication:** Agents should **stop waiting for Studio “Confirm round”**. Call `verify_issues_report_export` + `verify_report_sync` themselves.

---

## Still human / subject (not Studio)

These are **not** Studio UI dependencies:

1. **Launch Obscur** with remote debugging (`pnpm dev:desktop` / online · CDP `:9230`)
2. **Manual unlock / F5 repro** when agent cannot fill password (or use scripted unlock later)
3. **CodaCtrl Studio process** optional — only needed if human wants a dashboard

---

## Gaps to close in CodaCtrl (MCP-first P0)

| ID | Gap | Needed |
|----|-----|--------|
| **MF-1** | Docs/prompts still say *"Operator exports via Studio Monitor → Confirm round"* (`verify_dogfood_preflight.agentPrompt`) | Rewrite to MCP-only export steps |
| **MF-2** | Studio Monitor marketing *"no Cursor MCP required"* | Flip: MCP-first; Studio optional |
| **MF-3** | No MCP **subject launcher** | `client_subject_launch` / recipe: start Obscur with CDP args from `client.cdp.yaml` |
| **MF-4** | Stale session registry (Jul 6 sessions still listed) | Auto-prune dead CDP; `client_session_prune` default before connect |
| **MF-5** | Dual-window blocked chips force Studio narrative | MCP returns `blockedFlows` + **single-window golden path** as default; never require Studio for single-window |
| **MF-6** | `verify_salvage_preset_run` schema bug | Fix so agents don't hand-write rollup |
| **MF-7** | Cargo ops from wrong cwd / wrong crate | `obscur_desktop_lib` + crate `Cargo.toml` path |
| **MF-8** | Studio F5 crash | Fix shell; but **do not block** agent work on Studio health |

---

## Agent golden path (Obscur R-AUTH) — Studio optional

```text
1. studio_pathway                          # prove step
2. verify_dogfood_preflight                # ignore readyForOperatorExport
3. client_dev_environment_get              # need cdpTargetCount ≥ 1
4. client_session_connect { cdpPort: 9230, skipStackPreflight?: }
5. client_runtime_digest_pull / chain_append
6. verify_issues_list → promote
7. verify_issues_report_export             # agent-owned export
8. verify_operation_run { auth-boot-snapshot, proofTier: rc1 }
9. codegraph_explore                       # blast radius before patch
```

If step 3 fails: **ask human to launch Obscur with CDP** — not to “fix Studio Monitor.”

---

## Operating mode until MF-3

| Do | Don't |
|----|-------|
| Drive verify/salvage via MCP | Block on Studio F5 / Monitor chips |
| Export via `verify_issues_report_export` | Wait for Studio “Confirm round” |
| Treat Studio as optional viewer | Treat Studio as source of truth |
| Launch Obscur for CDP | Expect Studio to start Obscur CDP |

---

## Acceptance for “MCP replaces Studio client”

- [ ] Solo agent closes an investigation chain + export pack with Studio **quit**
- [ ] `verify_dogfood_preflight` no longer mentions Monitor Confirm as required
- [ ] Subject launch recipe documented or automated (MF-3)
- [ ] Single-window Obscur prove never requires dual-window Studio desk
