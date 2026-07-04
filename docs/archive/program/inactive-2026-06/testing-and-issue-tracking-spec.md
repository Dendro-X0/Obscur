# Testing and issue tracking specification

**Status:** Active — canonical process for Obscur-class projects  
**Last updated:** 2026-06-01  
**Applies to:** Native-first apps (Tauri + relay + SQLite + agent-assisted delivery) where **green CI can diverge from desktop runtime**

**Related:** [rules/06-testing-and-validation.md](../../rules/06-testing-and-validation.md) · [runtime-investigation-and-capture.md](./runtime-investigation-and-capture.md) · [unified-verification-matrix.md](./unified-verification-matrix.md) · [unified-verification-issues-register.md](./unified-verification-issues-register.md)

---

## 1. Purpose

This spec defines **one correct approach** for:

1. **Testing** — which proof layer to use, when, and what each layer actually proves  
2. **Tracking** — how issues are identified, recorded, and closed with evidence  
3. **Shipping claims** — what “done” and “fixed” mean without false-green CI

External tooling (e.g. CodaCtrl) is **optional and deferred**. Obscur’s built-in capture APIs plus this process are sufficient until that ecosystem is ready.

---

## 2. Proof model (five layers)

No single layer is enough. Every significant claim must name **which layers were executed** and **which were explicitly not**.

```text
L4  Manual matrix (two-user, milestone batch)       ← product truth, expensive
L3b Runtime capture manual (DevTools M0 bundle)      ← ad-hoc incidents
L3a Runtime capture E2E (Playwright automated)     ← fast golden-path regression
L2  Focused integration / contract tests           ← owner wiring, mocked I/O
L1  Unit tests + typecheck + boundary scripts      ← logic and architecture intent
```

| Layer | Proves | Does **not** prove | Primary commands / actions |
|-------|--------|-------------------|---------------------------|
| **L1 Contract** | Reducers, policies, grep/owner gates, pure logic | Tauri SQLite, cold restart, OS APIs | `pnpm -C apps/pwa typecheck`, targeted `vitest`, `pnpm gateway:boundaries:check` |
| **L2 Module contract** | Persistence/hydrate **modules** with mocked native | Packaged app remount, real write rejection | `pnpm verify:p5-persistence`, `pnpm verify:thread-history`, `pnpm verify:path-b-b3` |
| **L3a Automated capture** | Unlock + nav soak + reload + digest gates in ~1–3 min | Full DM A/B, OS notifications, packaged release | `pnpm capture:runtime` — [runtime-capture-e2e.md](./runtime-capture-e2e.md) |
| **L3b Manual capture** | Point-in-time desktop behavior, any repro | Automated regression unless saved to `docs/incidents/` | `copy(window.obscurM0Triage?.captureJson(300))` on **Tauri** |
| **L4 Manual matrix** | End-to-end product flows (A/B, two windows) | Fast iteration during implementation | [unified-verification-matrix.md](./unified-verification-matrix.md) §1–§7 |
| **L5 Dev Lab** | Fatal boundaries, programmatic unlock, **core benchmark suites**, synthetic load | Packaged production, CI without dev flag | [dev-lab-spec.md](./dev-lab-spec.md) — `pnpm verify:handoff` (handoff), `pnpm dev:lab:smoke` (slice) |

**Native SQLite:** use `pnpm capture:runtime:native` (Tauri WebView CDP) for persistence-adjacent claims; default Chromium mode is digest-only on `:3340`.

**False-green rule:** If L1 or L2 pass but the user reports a runtime bug, **L3 capture is required** before marking fixed. L2 alone is never sufficient for persistence, relay UX, or notification claims.

---

## 3. Testing — when to run what

### 3.1 During implementation (every PR-sized slice)

Run the **smallest L1/L2 superset** that touches the canonical owner:

| Area touched | Minimum gate |
|--------------|--------------|
| DM persist / hydrate | `pnpm verify:p5-persistence` + `pnpm verify:thread-history` |
| Thread history kernel | `pnpm verify:thread-history` |
| Group thread / ingest | `pnpm verify:thread-history` + `pnpm verify:path-b-b3` |
| Relay / runtime / shell | `pnpm verify:stability` |
| Community membership | `pnpm verify:path-b-membership` or slice named in handoff |
| Docs / handoff only | `pnpm docs:check` |

Always run **targeted vitest** for files changed, then the row above if the owner is in that domain.

### 3.2 Before merge / “implementation complete” for a subsystem

| Subsystem | L1/L2 required | L3a / L3b required when |
|-----------|----------------|---------------------------|
| DM outgoing durability | `verify:p5-persistence` | Send → bus → SQLite path touched: `capture:runtime:native` + incident if fail |
| DM history after restart | `verify:thread-history` | `capture:runtime:native` after reload scenario; manual cold quit if still failing |
| Relay startup UX | `verify:stability` | `capture:runtime` (warmup digest gates) |
| Shell / navigation | `verify:stability` | `capture:runtime` on route or startup changes |
| Group messaging | `verify:path-b-b3` | Only when backend not stubbed; else document **accepted stub** |

**Fast path:** run `pnpm capture:runtime` before every handoff checkpoint when desktop UX was touched (~2 min vs manual matrix).

### 3.3 Milestone / pre-tag (batch, not per slice)

Per [stability-first-delivery.md](./stability-first-delivery.md) and [rules/06-testing-and-validation.md](../../rules/06-testing-and-validation.md):

```bash
pnpm verify:stability
pnpm release:test-pack -- --skip-preflight
```

Then optional **L4** matrix pass — [unified-verification-matrix.md](./unified-verification-matrix.md) — filing failures in the register.

### 3.4 Surface choice

| Bug class | Required surface |
|-----------|------------------|
| SQLite / native persist | **Tauri** (`pnpm dev:desktop:online`) |
| Relay / coordination | Tauri preferred; browser `:3340` OK for non-Tor rows |
| UI-only (no native) | Browser acceptable for speed |
| Notifications / OS | **Packaged or dev Tauri** only |

---

## 4. Issue tracking

### 4.1 Three stores (one job each)

| Store | Path | Use for |
|-------|------|---------|
| **Issues register** | [unified-verification-issues-register.md](./unified-verification-issues-register.md) | Milestone-level open/fixed/accepted (`STAB-*`, `ACC-*`, matrix refs) |
| **Incident records** | [docs/incidents/](../incidents/) | Runtime bugs: repro + M0 JSON + honest verify matrix |
| **Session handoff** | [docs/handoffs/current-session.md](../handoffs/current-session.md) | Current atomic step, recent checkpoints, git SHA |

Do **not** track the same bug only in chat. Chat is not a store.

### 4.2 Issue ID schemes

| Prefix | Meaning | Example |
|--------|---------|---------|
| `STAB-*` | Stability / render-loop / shell | STAB-R |
| `ACC-*` | Accepted limitation (documented, not blocking) | ACC-01 |
| `P5-*` | Persistence survival band | P5-DM-4 (target integration proof) |
| `INC-YYYY-MM-DD-*` | Runtime incident file slug | `INC-2026-06-01-dm-outgoing-lost` |
| `O-*` | Symptom class (case study taxonomy) | O-2 outgoing lost after restart |

Link incidents to symptom class when applicable (see CodaCtrl [Obscur case study](file:///E:/Experimental%20projects/codactrl/docs/case-studies/obscur-green-ci-red-runtime.md)).

### 4.3 Severity

| Level | Definition | Required response |
|-------|------------|-------------------|
| **P0** | Core flow broken: auth lock, data loss, app unusable | Stop expansion; L3 capture; owner map; fix or feasibility analysis |
| **P1** | Major feature wrong; workaround exists | Incident + targeted L2; L3 before close |
| **P2** | Minor UX / edge case | Incident or register row; L2 if owner touched |
| **Accepted** | Known architectural limit | `ACC-*` row + doc; no “fix” claim |

### 4.4 Issue lifecycle

```text
reported → reproduced → captured (L3) → owner identified → fix slice → L2 green → L3 re-capture OR matrix row → closed
```

**States:**

| State | Criteria |
|-------|----------|
| **reported** | Symptom described; may be chat-only |
| **reproduced** | Minimal steps documented on correct surface |
| **captured** | `docs/incidents/<date>-<slug>.md` + JSON bundle exists |
| **fix proposed** | Owner module named; parallel paths listed |
| **contract verified** | L2 gate named and pass recorded in incident |
| **runtime verified** | L3 re-capture shows risk resolved **or** L4 matrix `[P]` |
| **closed** | Register/incident updated; handoff checkpoint |

**Close rule:** P0/P1 persistence or relay bugs **cannot** close on L2 alone.

---

## 5. Runtime capture protocol (L3a + L3b)

**Automated (preferred for golden path):** [runtime-capture-e2e.md](./runtime-capture-e2e.md) — `pnpm capture:runtime`

**Manual (ad-hoc repros):** [runtime-investigation-and-capture.md](./runtime-investigation-and-capture.md)

**Mandatory steps for every P0/P1 runtime bug:**

1. Reproduce on the correct surface (§3.4).  
2. In DevTools console **before restart**:

   ```js
   copy(window.obscurM0Triage?.captureJson(300))
   ```

3. Save:
   - `docs/incidents/YYYY-MM-DD-<slug>.json` — paste bundle  
   - `docs/incidents/YYYY-MM-DD-<slug>.md` — template from runtime-investigation doc  

4. In the markdown file, fill **What CI would claim** vs **What runtime showed**.  
5. Only then assign fix work (human or agent).

**Key probes (DM continuity):**

```js
window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity
```

---

## 6. Definition of done

### 6.1 Code change (general)

- [ ] Behavior implemented in **one canonical owner** (no parallel fix path)  
- [ ] L1: typecheck + targeted vitest pass  
- [ ] L2: domain `verify:*` pass if owner in that domain  
- [ ] L3: re-capture attached to incident **if** the bug was runtime-reported  
- [ ] Handoff `Next Atomic Step` updated  
- [ ] No “fixed” claim from intent or mocked tests alone  

### 6.2 Persistence / DM claim

- [ ] `pnpm verify:p5-persistence` pass (record count)  
- [ ] `pnpm verify:thread-history` pass if hydrate/display touched  
- [ ] Incident states **mocked boundary**: tests do not prove Tauri cold restart  
- [ ] If claiming cold-restart fix: L3 re-capture after quit → reopen **or** explicit deferred note  

### 6.3 Accepted / stubbed behavior

- [ ] `ACC-*` or handoff states stub (e.g. group send toast)  
- [ ] No matrix row marked `[P]` for that behavior  

---

## 7. Agent-assisted development rules

When using Cursor or other agents on Obscur:

1. Read [current-session.md](../handoffs/current-session.md) before code changes.  
2. Never mark complete on `verify:*` alone if the task is user-visible runtime behavior.  
3. Name the **mocked boundary** in test plans (“proves service logic; does not prove Tauri restart”).  
4. If the same symptom class appears twice, stop patch loops — [rules/11-feasibility-and-modular-safety.md](../../rules/11-feasibility-and-modular-safety.md).  
5. Add diagnostics at the canonical boundary **before** behavior patches when faults are unclear.  
6. Output incident path when reporting a runtime bug to the user.

---

## 8. Escalation triggers

Switch from feature work to recovery mode when:

1. Startup infinite load or auth lock loop  
2. Route freeze / blank shell  
3. **Recurring** self-authored DM loss after restore (O-2 class)  
4. L2 green + L3 digest `riskLevel: "high"` for same subsystem  
5. Third iteration on same symptom without new capture evidence  

Actions: L3 capture → owner map ([12-core-architecture-truth-map.md](../encyclopedia/12-core-architecture-truth-map.md)) → subtract parallel paths → replay L2 + L3 before resuming expansion.

---

## 9. Quick decision tree

```text
Is the bug user-visible on desktop?
├─ No  → L1/L2 only; document in PR/handoff
└─ Yes → Can you reproduce on Tauri?
         ├─ No  → file INC with "not reproduced"; gather steps
         └─ Yes → L3 capture BEFORE restart
                  → file docs/incidents/
                  → run domain verify:* (L2); record pass/fail honestly
                  → fix owner path
                  → L3 re-capture to close (P0/P1)
```

---

## 10. File map

| Need | Go to |
|------|--------|
| **This spec** | `docs/program/testing-and-issue-tracking-spec.md` |
| Dev Lab fast lane + issue backlog | `docs/program/dev-lab-spec.md` · `docs/program/dev-lab-issue-backlog.md` |
| Runtime capture E2E (automated) | `docs/program/runtime-capture-e2e.md` |
| Runtime capture manual | `docs/program/runtime-investigation-and-capture.md` |
| Milestone test matrix | `docs/program/unified-verification-matrix.md` |
| Open/fixed issue list | `docs/program/unified-verification-issues-register.md` |
| Incident bundles | `docs/incidents/` |
| Maintainer diagnostics | `docs/encyclopedia/08-maintainer-playbook.md` |
| Persistence contracts | `docs/program/p5-persistence-survival-contract.md` |
| Session continuity | `docs/handoffs/current-session.md` |
| External case study | CodaCtrl `docs/case-studies/obscur-green-ci-red-runtime.md` |

---

## 11. Summary (one paragraph)

**Test in layers:** L1/L2 during implementation for fast, mocked owner proof; **L3 runtime capture on Tauri** for any desktop-reported bug before and after fix; **L4 manual matrix** at milestones only. **Track in three places:** register for milestone issues, `docs/incidents/` for runtime evidence, handoff for current work. **Never close P0/P1 persistence or relay bugs on green `verify:*` alone** — state what mocks exclude and attach M0 capture when runtime is the source of truth.
