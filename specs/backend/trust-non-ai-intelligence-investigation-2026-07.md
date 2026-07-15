# Investigation — Non-AI trust intelligence (recipient-local DM warnings)

**Status:** Approved investigation (2026-07-11)  
**Band:** `TRUST-INT-1` — **ACTIVE** (pairs with `ASE-1`; recipient-local warnings)  
**Design:** [trust-non-ai-intelligence-design-2026-07.md](./trust-non-ai-intelligence-design-2026-07.md)  
**Program pairing:** [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md) · [02-warning-and-trust-model.md](../../docs/archive/greenfield/02-warning-and-trust-model.md) (concept reference)

---

## 1. Problem statement

Obscur’s recipient-local trust module (`dm-kernel-trust-assessment-port.ts`) warns Party B about social-engineering and abuse shapes **without server scoring, without LLM analysis, and without notifying Party A**.

Maintainer dogfood (2026-07-11) surfaced a **false-positive class**: the `msg.rate` signal fired on normal rapid back-and-forth with an **accepted** contact (Tester1, Standard sensitivity), showing an **elevated** “Trust notice” banner with copy *“High message rate in the last minute.”*

Separately, product discussion clarified an architectural constraint: **unlike LLM-based systems, Obscur cannot infer natural-language intent or cross-language scam semantics.** The module must still feel “intelligent” — catching real attack shapes while tolerating everyday conversation.

This investigation records current owners, failure modes, and the evidence base for a non-AI intelligence model spec.

---

## 2. Symptoms and evidence

| ID | Symptom | Evidence | Severity |
|----|---------|----------|----------|
| **TI-FP-1** | Trust banner on accepted peer during normal chat burst | Screenshot: Tester1 thread, Standard sensitivity, signal `msg.rate`, tier elevated | **High** — erodes trust in warnings |
| **TI-LIM-1** | English-centric phrase packs miss non-English SE prose | `dm-kernel-trust-social-engineering-signals.ts` header: “English-centric v1” | **Known limit** |
| **TI-LIM-2** | Single weak signals can dominate UX | Pre-tuning: `msg.rate` alone → elevated for accepted peers | **Design gap** |
| **TI-ARCH-1** | ASE friction modules (M1–M8) and DM trust banner use overlapping concepts but different owners | ASE contract M5 “planned”; DM kernel already implements SE detectors | **Integration debt** |

### 2.1 Pre-tuning thresholds (baseline)

| Constant | Value | Effect |
|----------|-------|--------|
| `MSG_RATE_WINDOW_MS` | 60_000 | 1-minute rolling window |
| `MSG_RATE_THRESHOLD` (standard) | 10 | >10 inbound → `msg.rate` |
| Accepted-peer multiplier | none | Same threshold for cold and accepted |

**Root cause of TI-FP-1:** rate-only signal with a low threshold and no relationship context gate.

---

## 3. Canonical owners (current)

| Concern | Owner module | Notes |
|---------|--------------|-------|
| Assessment orchestration | `dm-kernel-trust-assessment-port.ts` | Bundles, tiers, sensitivity post-processing |
| Spam / coordination shapes | `dm-kernel-trust-spam-signals.ts` | `msg.rate`, `invite.fanout` thresholds |
| Social-engineering phrase packs | `dm-kernel-trust-social-engineering-signals.ts` | Deterministic regex families |
| Link / domain shape | `dm-kernel-trust-link-signals.ts` | Suspicious URL, lookalike brand |
| Attachment shape | `dm-kernel-trust-attachment-signals.ts` | Risky filenames |
| Connection burst | `dm-kernel-trust-connection-signals.ts` | Request anti-abuse snapshot |
| Peer rolling state | `dm-kernel-trust-peer-state.ts` | Cross-thread inbound timestamps |
| Per-contact posture | `contact-trust-sensitivity.ts` | Relaxed → Vigilant policy |
| Banner UI | `use-dm-kernel-trust-banner.ts` · `dm-kernel-trust-banner.tsx` | Computes inputs, renders tier |
| Settings surface | `trust-settings-panel.tsx` | Privacy → trust education + sensitivity |
| Regression corpus | `dm-kernel-trust-threat-corpus.ts` | Named attack fixtures + expected tiers |
| ASE action friction | `send-ceremony-gate.ts`, identity binding, secret firewall | L2–L4 — **separate band** |

**Subtraction rule:** No new heuristics in React components. All signal detection stays in `dm-kernel/**` signal modules; assessment stays in the port.

---

## 4. Parallel paths (must not duplicate)

| Path | Risk |
|------|------|
| Component-local keyword checks in thread UI | Divergent tiers; untestable |
| ASE M5 “conversation-risk-scorer” as second assessment engine | Two owners for same signals |
| Server-side NLP / relay scoring | Violates private-trust + delivery invariants |
| Blocking delivery on tier | Violates delivery invariant |

**Canonical path:** `assessDmTrustWarning()` → sensitivity overlay → banner / future action gates.

---

## 5. What “intelligence” means without AI

| LLM approach (out of scope) | Non-AI approach (in scope) |
|-----------------------------|----------------------------|
| Semantic intent from arbitrary prose | **Compound evidence** from independent signal classes |
| Cross-language paraphrase detection | **Language-agnostic structure** (URLs, amounts, addresses, timing) |
| “Is this a scam?” black box | **Explainable signal list** + bundle ID in UI |
| Global sender reputation | **Recipient-local** relationship context (`contact.cold`, accepted peer) |

**Hypothesis (to validate in design):** False positives drop when **weak signals require compounding** and **relationship context adjusts thresholds**, without claiming semantic understanding.

---

## 6. Honest limits (product must not over-promise)

| Scenario | Detectable without AI? |
|----------|------------------------|
| Known SE playbook in covered locale (credential harvest, gift cards, remote access) | **Yes** — pattern packs + bundles |
| Cold contact + financial pivot + urgency | **Yes** — temporal + structural |
| Phishing URL / lookalike domain | **Yes** — link signals |
| Novel scam in fluent, benign prose | **No** |
| Sarcasm, inside jokes, cultural nuance | **No** |
| Cross-language semantic equivalence | **No** — unless locale pack or structural artifact present |
| User voluntarily discloses passphrase | **No** — ASE literacy + L4 firewall only at paste/export |

Copy must remain honest: warnings **suggest verification**, never claim certainty.

---

## 7. Immediate mitigation (2026-07-11 — **L1 verified**)

Slice landed in working tree:

| Change | Rationale |
|--------|-----------|
| `MSG_RATE_WINDOW_MS`: 60s → **120s** | Everyday bursts spread across a longer window |
| `MSG_RATE_THRESHOLD`: 10 → **18** | Higher bar for cold contacts |
| Accepted-peer **flood multiplier** 2.5× | ~45+ msgs / 2 min before rate-only on established peers |
| Accepted + rate-only → **info** tier (not elevated) | Reduce banner alarm on residual edge cases |
| Corpus **`spam_accepted_normal_burst_suppressed`** | Regression lock for TI-FP-1 |

**Proof:** L1 — trust assessment, spam signals, threat corpus tests **PASS** (2026-07-11).

---

## 8. TRUST-INT-1b structural slice (2026-07-11 — **done**)

| Detector | Owner | Status |
|----------|-------|--------|
| Punycode host (`xn--`) | `dm-kernel-trust-link-signals.ts` | Done + corpus fixture |
| Mixed-script hostname (Latin + Cyrillic) | `dm-kernel-trust-structural-signals.ts` | Done |
| OTP digit-run exfil shape | `dm-kernel-trust-structural-signals.ts` → `detectCredentialHarvestRequest` | Done |

## 9. TRUST-INT-1c locale packs (2026-07-11 — **done**)

| Locale | Owner | Corpus fixtures |
|--------|-------|-----------------|
| `es` | `dm-kernel-trust-social-engineering-locale-packs.ts` | `se_credential_harvest_es_cold`, `se_off_platform_redirect_es_cold` |
| `zh` | same | `se_authority_impersonation_zh_cold`, `se_remote_access_zh_cold` |

## 10. TRUST-INT-2 bridge (**done**)

`assessDmTrustActionGate()` + `enrichDmTrustAssessInput()` map tier → ASE L0–L3. Wired surfaces: send ceremony, link-open, attachment export (chat + vault), incoming-request junk routing, accept-dialog trust warning.

---

## 11. Open questions for design spec

1. Should **accepted-peer** `msg.rate` require a **second signal** (any content or metadata) before firing at all?
2. Which **structural detectors** ship next (homoglyph domains, OTP digit runs, punycode)?
3. How do **ASE L2–L4 gates** subscribe to the same `TrustSignalId` set without duplicating regex?
4. When do **locale packs** (es, zh) ship relative to structural layer?
5. Which **metadata signals** (`key.age`, WoT distance) are feasible on current ingest?

---

## 12. Proof plan (investigation exit)

| Layer | Command / action |
|-------|------------------|
| **L1** | `pnpm verify:trust-int-l1` |
| **L2** | Dev-lab matrix + fixtures (`dev-lab-trust-matrix.test.ts`, `dev-lab-trust-fixtures.test.ts`) — included in L1 gate |
| **L3 (programmatic)** | `pnpm verify:trust-int-l3-devlab` after `pnpm dev:desktop:online` |
| **L3 (manual)** | [trust-int-l3-verification-2026-07.md](./trust-int-l3-verification-2026-07.md) — desktop dogfood checklist |
| **L4** | Same runbook §4 — Settings trust panel + DM banner + ASE confirm demo GIF |

**L3 exit criteria (summary):** accepted peer rapid DM → no elevated banner; cold `BUNDLE_FIN_COLD` / `BUNDLE_SE_COLD` still fire; link/send/export/accept ASE gates show confirm when gated.

---

## 13. References

| Document | Role |
|----------|------|
| [trust-non-ai-intelligence-design-2026-07.md](./trust-non-ai-intelligence-design-2026-07.md) | Approved design — composition rules, roadmap |
| [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md) | Human-layer friction modules |
| [19-pre-public-reliability-and-trust-contract.md](../../docs/trust/19-pre-public-reliability-and-trust-contract.md) | Release discipline |
| `apps/pwa/app/features/dm-kernel/dm-kernel-trust-assessment-port.ts` | Runtime owner |
