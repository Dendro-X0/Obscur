# TRUST-INT — L3/L4 verification runbook

**Band:** `TRUST-INT-1` / `TRUST-INT-2` (parallel to primary handoff)  
**Parent specs:** [trust-non-ai-intelligence-investigation-2026-07.md](./trust-non-ai-intelligence-investigation-2026-07.md) · [trust-non-ai-intelligence-design-2026-07.md](./trust-non-ai-intelligence-design-2026-07.md)  
**ASE contract:** [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md)  
**Status:** L1 gate ready · L3/L4 awaiting maintainer desktop dogfood

---

## 1. Scope

Manual evidence required before claiming **“accepted-peer rapid chat does not false-positive”** and **“ASE gates consume trust assessment”** in product copy or demos.

| Layer | What it proves |
|-------|----------------|
| **L1** | Unit/contract tests for assessment port, metadata signals, ASE gates (agent-run before handoff) |
| **L2** | Dev-lab trust matrix + threat corpus fixtures (scripted; optional UI dev-lab runner) |
| **L3** | Desktop dogfood — banner tier + ASE friction dialogs (this doc §3) |
| **L4** | Maintainer demo GIF: Settings trust panel + cold DM banner + one ASE confirm (this doc §4) |

**Out of scope:** ASE-1d contact-request sandbox (siloed). M1 private-key export trust. M6 OOB.

---

## 2. Prerequisites

- **Surface:** Tauri desktop build with CDP (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230`).
- **Profiles:** Two unlocked profiles with **accepted** contact relationship (e.g. Tester1 ↔ DemoUser).
- **Relay:** Local or dev relay so DMs deliver between profiles.
- **Preflight:** `verify_dogfood_preflight` → `subject-cdp` ok; `client_dev_environment_get` shows CDP targets.

### L1 gate (run first)

```bash
pnpm verify:trust-int-l1
```

Broader release trust slice (optional, does not include all TRUST-INT-2 gates):

```bash
pnpm verify:trust-v1.9.5
```

### L2 programmatic gate (agent-run)

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/dev-lab/dev-lab-trust-matrix.test.ts \
  app/features/dev-lab/dev-lab-trust-fixtures.test.ts
```

### L3 programmatic gate (dev-lab CLI — requires online stack)

Start desktop + relays, then:

```bash
pnpm dev:desktop:online -- --rebuild   # once, if static shell stale
pnpm verify:trust-int-l3-devlab
```

Runs `trust-accepted-burst-live` (accepted peer 22-DM burst → no elevated banner) and `trust-live` (cold financial → `BUNDLE_FIN_COLD` banner).

Native Tauri CDP variant (optional, closer to maintainer dogfood):

```bash
pnpm dev:desktop:online
pnpm dev:lab:run -- --scenario trust-accepted-burst-live --cdp http://127.0.0.1:9230
```

---

## 3. L3 — Desktop dogfood checklist

Record: date, commit, profile ids, relay, pass/fail per row. Capture screenshots or MCP `client_screenshot_capture` under `.codectx/verify/`.

### 3.1 Banner — false-positive regression (TRUST-INT-1a)

| # | Step | Expected | Pass |
|---|------|----------|------|
| 1 | Open DM between **accepted** Tester1 ↔ DemoUser. Send **20+ short messages** within 2 minutes (both directions). | **No** `elevated` or `critical` trust banner. `info` tier acceptable if copy mentions rate only. | ☐ |
| 2 | Inspect banner DOM if visible: `[data-testid="dm-kernel-trust-banner"]` `data-trust-tier`. | Tier is `none` or `info` — not `elevated`/`critical` for benign rapid chat. | ☐ |

### 3.2 Banner — cold contact bundles still fire (TRUST-INT-1b/c)

Use a **non-accepted** cold peer or dev-lab injected thread.

| # | Step | Expected | Pass |
|---|------|----------|------|
| 3 | Cold DM: “Pay $500 asap via wire transfer today.” | `BUNDLE_FIN_COLD` · tier `elevated` or `critical` · banner visible. | ☐ |
| 4 | Cold DM: credential-harvest phrase (e.g. “Enter your seed phrase to verify”). | `BUNDLE_SE_COLD` or equivalent SE bundle · banner visible. | ☐ |
| 5 | Cold DM with suspicious URL: `https://example-security.test/login?ref=abc` | `BUNDLE_PHISH_COLD` or link signal in banner bullets. | ☐ |

### 3.3 ASE action gates (TRUST-INT-2)

| # | Step | Expected | Pass |
|---|------|----------|------|
| 6 | In cold elevated thread, click external link in message. | **Link-open confirm** dialog (guarded external link). Cancel works; proceed opens link. | ☐ |
| 7 | Attempt send containing seed-phrase-shaped content to cold/untrusted context. | **Send ceremony** `trust_confirm` step before delivery. | ☐ |
| 8 | Incoming **contact request** from cold peer with elevated trust assessment. | Accept dialog shows **trust warning** (not silently accepted). | ☐ |
| 9 | Export attachment from **chat** (cold elevated or repeat-hash fixture). | **Export confirm** before write to disk. | ☐ |
| 10 | Export same class of item from **Vault** grid. | **Export decrypted copy…** shows trust export confirm when gated. | ☐ |

### 3.4 Metadata signals (TRUST-INT-1d — best-effort)

| # | Step | Expected | Pass |
|---|------|----------|------|
| 11 | Contact request from **never-seen** pubkey (outside WoT). | Banner or accept path may show `graph.wot_distance` bullet (info/elevated per composition). | ☐ |
| 12 | Same CAS attachment hash shared across ≥3 cold peers within 7 days (lab seed or coordinated test). | `attachment.repeat_hash` signal; export/link gates may require confirm. | ☐ |

**Note:** Rows 11–12 are hard to reproduce organically; L1 corpus `metadata_attachment_repeat_hash_phish_cold_bundle` + fanout state tests are acceptable fallback if manual seeding is impractical. Mark row **N/A** with L1 evidence path.

---

## 4. L4 — Maintainer demo (Phase 5 inventory)

| Asset | Content |
|-------|---------|
| GIF 1 | Settings → Privacy / trust panel overview |
| GIF 2 | Cold DM → elevated banner → dismiss cooldown |
| GIF 3 | Link-open or export confirm from ASE gate |

Store under `docs/trust/demos/` or Studio `client_demo_record_gif` promotion path per verify workflow.

| Field | Value |
|-------|--------|
| Recorder | |
| Commit | |
| Profiles | |
| Pass/fail | |

---

## 5. Sign-off

| Role | Name | Date | L3 | L4 |
|------|------|------|----|----|
| Maintainer | | | ☐ | ☐ |

When L3 rows 1–10 pass, update investigation §12 and antisocial contract register: **TRUST-INT L3 dogfood complete**.

---

## 6. Evidence commands (MCP)

```text
verify_dogfood_preflight
client_dev_environment_get
client_session_connect          # CDP 9230
client_navigate / client_interact_*
client_screenshot_capture
client_investigation_chain_append
```

---

## 7. Rollback / owners

| Owner | Path |
|-------|------|
| Assessment composer | `dm-kernel-trust-assessment-port.ts` |
| ASE enrichment | `dm-kernel-trust-assess-context.ts` |
| Banner hook | `use-dm-kernel-trust-banner.ts` |
| Link gate | `use-guarded-external-link-open.ts` |
| Export gates | `dm-kernel-trust-export-action-gate.ts`, `vault-attachment-export-gate.ts` |
| Send ceremony | `send-ceremony-gate.ts` |

---

## 8. Known blockers (2026-07-11)

| Item | Notes |
|------|--------|
| No CDP targets | Desktop not running — operator must launch Tauri with remote debugging before L3 |
| `verify:trust-v1.9.5` | Legacy slice; use `verify:trust-int-l1` for TRUST-INT-2 gate coverage |
