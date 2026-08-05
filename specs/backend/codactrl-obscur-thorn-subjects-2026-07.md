# CodaCtrl subjects — Obscur as vibe-ruin / black-box case study

**Status:** Active product input for CodaCtrl Studio ↔ IDE · 2026-07-28  
**Audience:** Solo maintainer + CodaCtrl agents (not an Obscur rewrite plan)  
**Source case:** Obscur monorepo (~5.9k files · 28 packages · 146 entrypoints · Map snapshot via Studio)  
**Related:** [codactrl-improvement-findings-2026-07.md](../program/codactrl-improvement-findings-2026-07.md) · [production-rewrite-and-devlab-tombstone-2026-07.md](../backend/production-rewrite-and-devlab-tombstone-2026-07.md) · [obscur-engine-lab-charter.md](../program/obscur-engine-lab-charter.md)

---

## Purpose

Obscur is the **reference ruin**: a project damaged by vibe coding, parallel owners, fake validation surfaces, and redesign loops. The goal is **not** to finish Obscur by chat flood.

**Goal:** list thorny classes so **CodaCtrl Studio + IDE** can make salvage feasible for a solo human who cannot read 6,000 files or keep up with message storms.

| Actor | Role |
|-------|------|
| Maintainer | Chooses subject · confirms visible proof · improves Studio |
| Studio | Map · conflicts · plans · captures · registers · handoffs |
| IDE agent | Executes only what Studio planned · on named surface · with proof hooks |
| Obscur repo | Frozen case study until Studio can hold the architecture |

---

## Why Obscur broke (five thorns)

| ID | Thorn | What it looked like | Why solo humans fail |
|----|-------|---------------------|----------------------|
| **T1** | **Parallel owners** | Session, relays, DM, identity each have 2+ writers | Cannot hold conflict graph in head |
| **T2** | **Wrong truth surface** | Dev Lab / vitest / engine-lab green ≠ packaged desktop | “90% done” then wall |
| **T3** | **Invisible feedback** | Edit `apps/pwa/app` · Tauri still serves stale `out/` | Feels like wrong repo |
| **T4** | **Dual product charter** | Engine Lab (“UI archived”) vs ship installer | Every plan veers blindfolded |
| **T5** | **Package sprawl** | 28 workspaces · 55 edges · duplicate transport/auth stacks | Map without “freeze these” is noise |

These are **CodaCtrl product requirements**, not more Obscur feature tickets.

---

## Subjects for Studio ↔ IDE (must-build)

Each subject: **Studio capability** + **IDE agent contract** + **Obscur acceptance example**.

### S1 — Owner conflict graph (architecture)

| | |
|--|--|
| **Studio** | From Map + code indexes: lifecycle → writers/readers; flag ≥2 mutators for same lifecycle (session hydrate, relay publish, DM persist, profile scope). |
| **IDE** | Refuse patches that add a writer without subtracting one; show conflict IDs in plan card. |
| **Obscur example** | `auth-kernel-boot-owner` vs scatter `auth-gateway` / `use-identity` restore; damus ACTIVE vs pool STANDBY failover. |

### S2 — Truth-surface binding (anti–vibe-green)

| | |
|--|--|
| **Studio** | Named surfaces: `release-exe` · `parity-desktop` · `unit` · `lab-tombstoned`. Claims (“fixed”, “ready”) require a surface tag. |
| **IDE** | Never accept Dev Lab / L5 / live-Next as ship proof. Attach digest/chain to `release-exe` or `parity-desktop` only. |
| **Obscur example** | P1–P4 on `obscur_desktop_app.exe`; `pnpm dev:lab:*` exit 1. |

### S3 — Feedback / shell freshness (anti–black-box edit)

| | |
|--|--|
| **Studio** | Detect static-shell projects; show “code ≠ pixels” when stamp/revision mismatches sources. |
| **IDE** | After UI/logic edit: require rebuild step or refuse “visible fix” claim; surface stamp in handoff. |
| **Obscur example** | `pnpm dev:desktop -- --rebuild`; stamp-mismatch banner; CD-3. |

### S4 — Vertical slice plans (anti–blindfold roadmap)

| | |
|--|--|
| **Studio** | Plan = one user action path (e.g. unlock → pool → send DM), dependencies, forbidden parallel paths, proof nodes — not “redesign everything.” |
| **IDE** | Execute one slice; stop at wall; export chain; no mid-slice feature expansion. |
| **Obscur example** | R-AUTH · R-RELAY · R-ACCOUNT from rewrite charter — capture before code. |

### S5 — Freeze / subtract proposals (anti–sprawl)

| | |
|--|--|
| **Studio** | From Map: propose “keep N packages / freeze M”; impact if frozen; deletion candidates. |
| **IDE** | Work only inside keep-set until slice greens; no new packages without Studio job. |
| **Obscur example** | Keep: desktop + engine-host + auth + transport + DM; freeze coordination/relay-gateway/most `@dweb/transport-*` duplicates. |

### S6 — Investigation chains without human flood

| | |
|--|--|
| **Studio** | One chain · rollup · agent-handoff.md · ≤1 page maintainer read. |
| **IDE** | Append nodes; do not dump transcripts into chat as the record of truth. |
| **Obscur example** | Existing RIW boot artifacts; fill `signalsExtract`; CD-1/CD-2 digests. |

### S7 — Vibe-ruin salvage mode (product narrative)

| | |
|--|--|
| **Studio** | Preset mission: “salvage vibe-coded monorepo” → run S1–S6 in order; output conflict register + freeze set + first vertical slice. |
| **IDE** | Default refuse big-bang rewrite; default demand Studio job id. |
| **Obscur example** | This document as the first salvage mission pack. |

---

## Seed deficiency IDs (carry forward)

| ID | Need |
|----|------|
| CD-1 | F5 auth digest chain on parity/release without lab unlock |
| CD-2 | Relay pool role + events assert |
| CD-3 | Shell stamp in digest after rebuild |
| CD-4 | Packaged exe attach never requires Dev Lab |
| **CD-5** | Owner conflict graph (S1) — **new** |
| **CD-6** | Truth-surface tags on claims (S2) — **new** |
| **CD-7** | Stale-shell / stamp gate in Studio (S3) — **new** |
| **CD-8** | Vertical-slice planner (S4) — **new** |
| **CD-9** | Freeze-set from Map (S5) — **new** |
| **CD-10** | Salvage mission preset (S7) — **new** |

---

## Maintainer operating rules (solo)

1. **One subject at a time** in Studio (e.g. CD-5), not Obscur feature chat storms.  
2. Prefer **rollup / handoff / Map** over reading agent walls of text.  
3. Obscur code changes only when a Studio job names surface + slice + proof.  
4. If Studio cannot express the conflict → **improve CodaCtrl**, do not invent Obscur patches to compensate.

---

## Explicit non-goals (this doc)

- Finishing Obscur v2 / demos / community  
- Eleventh blind redesign of Obscur without S1–S5  
- Restoring Dev Lab as validation  
- Requiring the maintainer to manually read the monorepo

---

## Next Studio job (suggested)

**Job title:** `salvage-obscur-T1-owner-conflicts`  
**Output:** conflict graph for session + relay publish + DM persist (top 10 dual-owner edges)  
**Maintainer read:** ≤1 page  
**IDE:** none until graph exists

---

## MCP dogfood — 2026-07-29 (consolidated 7-tool surface)

**Server:** `user-codactrl-studio` · 7 surface tools · `workspaceAligned: true`

| Works | `unknown method` on daemon (MCP lists them; RPC missing) |
|-------|--------------------------------------------------------|
| `studio_help` — 100+ legacy actions under 7 lanes | `studio_pathway` / `verify_salvage_pathway` |
| `repo_architecture_draft` — 28 nodes · 55 edges · app/package zones | `studio_owner_conflicts_get` / `repo_explore_owner_conflicts` |
| `repo_explore_run` — `re-c97bc84335e6` | `studio_map_summary` / `studio_map_hop` |
| `repo_explore_flows` — CI/build flows | `verify_freeze_set_propose` / `verify_keep_set_binding` |
| `client_dev_environment_get` | `subject_shape_classify` / `verify_vertical_slice_evaluate` |
| `verify_agent_boot_status` | |
| `perf_target_resolve` (desktop 105; website still ranked 140) | |

**Rust refactor gap:** profile reports `crateCount: 0` — `packages/libobscur` + `apps/desktop/src-tauri` sit outside the pnpm graph CodaCtrl indexes. Architecture draft is **TS package boundary only** until Cargo workspace is wired.

**Runtime:** CDP `:9230` closed — start desktop before post-refactor proof.

### Prior dogfood — 2026-07-28 (pre-consolidation)

See git history; superseded by 7-tool surface above.

---

## External research — anti–vibe-junk (2026-07-28)

Sources: Cursor forum + public repos (not Obscur-specific). Maps to CodaCtrl subjects S1–S7.

### Cursor stack (what community actually uses)

| Layer | Role vs junk accumulation | Limit |
|-------|---------------------------|--------|
| **Rules** (`.cursor/rules/*.mdc`) | Style + scope; globs per language/folder | Model can ignore |
| **AGENTS.md** | Boot + hard constraints + route table | Drifts; keep thin |
| **Skills** | Multi-step runbooks (spec → implement → proof) | Optional unless @ |
| **Hooks** | Deterministic block/format/test — **cannot be ignored** | Best for “never” |
| **Plan mode + Agent Review** | Surgical diffs; reject hunks | Still human gate |
| **`.cursorignore`** | Freeze stable paths from agent edit | Terminal/MCP can bypass |

Forum consensus: [Rules vs Skills vs Hooks](https://forum.cursor.com/t/rules-vs-skills-vs-commands-vs-hooks/151829) · [integrity issues → Plan/Review/rules](https://forum.cursor.com/t/repeated-critical-ui-code-integrity-issues-caused-by-cursor-agent/158903) · [rules are passive → want mandatory](https://forum.cursor.com/t/feature-request-mandatory-rule-enforcement-for-ai-agents/151050) · [TDD/DDD or entropy](https://forum.cursor.com/t/vibe-coding-without-tdd-and-ddd-methodlogy-is/78298)

### Public tools / repos

| Artifact | Why it fights junk |
|----------|-------------------|
| [agents-md-doctor](https://github.com/ItsHege/agents-md-doctor) (`npx agents-doctor lint .`) | Dead commands/paths, conflicting nested AGENTS |
| [CursorRIPER](https://github.com/johnpeterman72/CursorRIPER) | Research→Plan→Execute; no code in Research/Plan |
| [spec-kitty](https://github.com/ale-ferreiras/spec-kitty) | Specs + work packages + worktrees + accept/merge |
| [agent-workspace-fabric](https://github.com/dimileeh/agent-workspace-fabric) / [agent-orchestrator](https://github.com/composiohq/agent-orchestrator) | Isolated worktrees; validation before merge |
| [vibe-coding-ai-rules](https://github.com/obviousworks/vibe-coding-ai-rules) | Portable AGENTS + Cursor rule packs |
| [open-agent-toolkit](https://github.com/voxmedia/open-agent-toolkit) | Cross-tool AGENTS/CLAUDE/Cursor alignment |
| Thin `.cursor` layout ([DEV article](https://dev.to/shrouwoods/an-efficient-cursor-directory-less-context-better-agents-kl0)) | Always-on thin; skills/reference on demand |

### Patterns that match Obscur failure (and CodaCtrl gaps)

| Vibe failure | Community antidote | CodaCtrl subject |
|--------------|--------------------|------------------|
| Parallel writers / scope creep | One owner per file/lifecycle; Plan before Execute | S1 · S4 |
| Green tests ≠ product | Explicit proof surface; hooks gate commit | S2 · hooks |
| Invisible / stale surface | Ignore generated shells; freshness gates | S3 |
| Rule/doc drift | `agents-doctor` lint in CI | S6 |
| Rewrite theater | Spec Kitty / RIPER — no Execute without approved plan | S7 salvage |

**Implication for CodaCtrl:** soft rules alone never stopped Obscur junk. Studio must supply what forum users demand next: **mandatory hooks-class gates** (truth surface, freeze-set, owner conflict) wired into IDE agents — not another AGENTS.md essay.

