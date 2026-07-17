# Feasibility — Vault chat→grid persistence (stuck loop exit)

**Status:** Maintainer decision required · **no further patch-debug**  
**Date:** 2026-07-15  
**Band:** `VAULT-SANDBOX-1` / Phase 6 chat intake  
**Rules:** [`rules/11-feasibility-and-modular-safety.md`](../../rules/11-feasibility-and-modular-safety.md) · modular-iteration silo + reintegration  
**Evidence (this session):** Toast `vault.saveFromChatSuccess` (“Saved to your encrypted local vault.”) while Vault **RECENT MEDIA** shows empty placeholders · profile `TESTER2` · build **1.9.12** · Media modal still lists thread CDN attachments (unrelated to Vault catalog)

---

## 1. Verdict

**Continuing to patch the existing chat→vault → aggregator → Vault-grid path is not a feasible engineering use of time.**

Observed over multiple weeks (maintainer pause 2026-07-14; Phase 6 design + row-proof + taxonomy; repeated dogfood F8): success UX can appear without a durable, refresh-stable Vault catalog row. Further incremental debugging of the same owner graph (`save-chat-attachment-to-vault` → `local-media-store` → SQLite/index → `use-vault-media` / aggregator) has **exceeded the ≥3 iteration / week wall**. Per rules/11: **stop the patch loop**; choose cancel, siloed redesign, or declare the product goal temporary-reduced.

This is **not** a claim that ciphertext-on-disk or Secure Upload is impossible — those remain separate owners (G8 Secure Upload soak). The **stuck goal** is specifically: *chat Media / Save to Vault produces a Vault-page row that survives refresh*.

---

## 2. What is still valid (do not throw away blindly)

| Keep | Why |
|------|-----|
| Encrypt-on-write / `.obscurvault` | Sandbox Phases 1–4 — still required for Secure Upload |
| `profiles/{id}/vault/{category}/` taxonomy | Phase 5b — layout hygiene; does not fix chat→grid |
| `VAULT_SAVE_FROM_CHAT_ENABLED = false` in source | Intentional kill switch; if toast still appears, that is a **UI/path leak**, not permission to re-patch save logic |
| G8 runbook for Secure Upload | Only honest demo path until a new intake owner exists |

| Do not keep investing in | Why |
|--------------------------|-----|
| Chat save → toast → refresh → hope grid updates | Same failure class F8 for weeks |
| “One more” refresh/index/event bus patches | Violates pause + feasibility |

---

## 3. Root shape (architecture, not next debugger target)

Multiple surfaces share “vault” language but **different truths**:

```text
Thread Media modal  →  message/CDN attachments (session UI)     ≠ Vault catalog
Save to Vault toast →  claims local vault persistence            ≠ proven grid row
Vault page grid     →  aggregator + standalone local index       ≠ thread Media
Secure Upload       →  explicit local write owner (demo path)    ≈ intended at-rest path
```

False success thrives when **toast owner ≠ catalog visibility owner**. Row-proof was designed to close that; dogfood still disagrees with L1. That is a **owner/contract failure**, not a missing `console.log`.

---

## 4. Maintainer options (pick one)

### Option **X — CANCEL Phase 6** (cheapest, honest)

- Chat→vault **permanently cancelled** for product claims.
- Subtract remaining Save-to-Vault affordances / success toasts that can fire without a catalog row (hygiene only — no “fix save”).
- Vault product = **Secure Upload + export + lock** only.
- Update `v1.9.13-scope.md`: drop Phase 6b; close G8 only on Secure Upload soak or defer marketing claim.
- **Does not** rewrite modules.

### Option **Y — VAULT-INTAKE-2 greenfield (siloed rewrite)** (user-preferred shape)

Charter a **new** intake owner under a **new** module boundary; **subtract** chat write path from `local-media-store` / Phase 6 adapters before wiring UI.

| Contract | Requirement |
|----------|-------------|
| Single write owner | One module writes ciphertext + catalog row |
| Success evidence | Toast **only** after Vault grid L1 fixture proves row for `(profileId, objectId)` |
| Refresh invariant | Quit/relaunch → same row without manual reload |
| No parallel path | Delete/disable `save-chat-attachment-to-vault` and message-list quick-save once new owner lands |
| Proof before UI | Automated L3 (no dogfood unlock loops) mandatory in charter |

**Allowed:** redesign inside silo.  
**Forbidden:** patching Phase 6 “until it works” inside the old graph.

Estimate: separate concentration unit (not a day of debug). Re-integration study before reconnecting Media modal.

### Option **Z — Temporary reduction (already mostly true)**

- Document: chat save **unsupported**; Media modal ≠ Vault.
- Leave flag false; stop 1.9.13 Phase 6 work; ship taxonomy/G8 Secure Upload only if G8 passes.
- Same product honesty as X without full CANCEL wording.

---

## 5. Explicit non-actions (this thread)

- No more investigation patches on chat save refresh.
- No claiming “fixed” from L1 alone.
- No Strategy A Phase 6b flag flip after this feasibility find.

---

## Maintainer decision (2026-07-15)

**Chose Y — goal preserved.** Chat→Vault / local encrypted Vault is **not** cancelled for public-release mediocrity. Patch-debug of the Phase 6 path remains forbidden.

**Charter:** [vault-intake-2-charter-2026-07.md](./vault-intake-2-charter-2026-07.md)

Options X/Z rejected as product direction. Temporary demo-safe 1.9.12 packaging may still ship with chat save **disabled** until INTAKE-2 L3 — that is honesty during rebuild, not goal abandonment.
