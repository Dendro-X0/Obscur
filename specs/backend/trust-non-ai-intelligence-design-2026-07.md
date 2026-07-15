# Design — Non-AI trust intelligence (recipient-local DM warnings)

**Status:** Approved for implementation (2026-07-11)  
**Investigation:** [trust-non-ai-intelligence-investigation-2026-07.md](./trust-non-ai-intelligence-investigation-2026-07.md)  
**Band:** `TRUST-INT-1` — **ACTIVE**  
**Program pairing:** [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md)

---

## 1. Design thesis

Obscur trust intelligence **does not interpret natural language**. It evaluates **deterministic, explainable evidence** composed from:

1. **Relationship context** — cold vs accepted, sensitivity posture  
2. **Temporal behavior** — thread age, financial pivot window, burst rate  
3. **Structural content** — URLs, payment identifiers, crypto addresses, attachment names  
4. **Pattern packs** — curated social-engineering phrase families (locale-scoped)  
5. **Coordination metadata** — fanout, connection bursts (device-local aggregates)

**Intelligence emerges from composition**, not from a single detector or an opaque model.

```text
         ┌─────────────────────────────────────────┐
         │  Signal detectors (pure functions)       │
         │  spam · SE · link · attachment · conn   │
         └──────────────────┬──────────────────────┘
                            │ TrustSignalId[]
                            ▼
         ┌─────────────────────────────────────────┐
         │  assessDmTrustWarning (bundle composer)  │
         │  priority-ordered bundles → tier         │
         └──────────────────┬──────────────────────┘
                            │
                            ▼
         ┌─────────────────────────────────────────┐
         │  applyContactTrustSensitivity (policy)   │
         └──────────────────┬──────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     DmKernelTrustBanner (L1)     ASE action gates (L2–L4) [future]
```

---

## 2. Invariants (must never break)

| ID | Invariant |
|----|-----------|
| **I1 Delivery** | Warning tier **never blocks** message arrival |
| **I2 Sender silence** | Party A is **never notified** that B saw a warning |
| **I3 No platform enforcement** | Vendor layer never bans/throttles based on trust score |
| **I4 Reproducibility** | Same rule pack version + same input → same tier |
| **I5 Transparency** | UI lists **active signals**; copy never says “AI detected scam” |
| **I6 Neutrality** | Ideology/hobby keywords alone **never** elevate tier |
| **I7 Recipient-local** | Assessment runs on B’s device only; no relay upload of body scores |

---

## 3. Signal taxonomy

### 3.1 Classes

| Class | Detectors | Language dependency |
|-------|-----------|---------------------|
| **A — Relationship** | `contact.cold` | None |
| **B — Temporal / coordination** | `msg.rate`, `invite.fanout`, `connection.request_burst` | None |
| **C — Structural financial** | `thread.pivot_financial`, `thread.financial_pressure`, `commerce.urgency_pressure` | Low (symbols, addresses) |
| **D — Structural link / file** | `link.suspicious_url`, `link.lookalike_brand`, `attachment.risky_filename` | None |
| **E — SE pattern packs** | `thread.credential_harvest`, `thread.authority_impersonation`, … | **Locale** (regex packs) |
| **F — Metadata** | `key.age`, `graph.wot_distance`, `attachment.repeat_hash` | None |

### 3.2 Signal catalog (v1 shipped)

| Signal ID | Class | Trigger summary |
|-----------|-------|-----------------|
| `contact.cold` | A | Unaccepted peer or forced-cold sensitivity |
| `msg.rate` | B | Inbound count > threshold in rolling window |
| `invite.fanout` | B | Connection requests > threshold / 24h |
| `connection.request_burst` | B | Anti-abuse snapshot burst |
| `thread.pivot_financial` | C | Financial mention within pivot window of first peer msg |
| `thread.financial_pressure` | C | Financial mention on cold contact outside pivot |
| `commerce.urgency_pressure` | C | Urgency regex match |
| `link.suspicious_url` | D | Credential-shaped / off-platform unlock paths |
| `link.lookalike_brand` | D | Homoglyph / typosquat heuristics |
| `attachment.risky_filename` | D | Double extension, executable hints |
| `graph.wot_distance` | F | Peer outside accepted WoT roots (v1: not accepted) |
| `attachment.repeat_hash` | F | Same CAS digest from ≥3 peers in 7d window |
| `thread.*` (SE family) | E | Pattern pack match — see `dm-kernel-trust-social-engineering-signals.ts` |

### 3.3 Pattern pack policy

- Packs are **versioned regex lists** per locale (`en` v1 shipped).
- **Structural layer (C/D)** always runs regardless of locale.
- New locales add files or sections — **no** runtime LLM fallback.
- Each pattern must have **corpus fixture** in `dm-kernel-trust-threat-corpus.ts`.

---

## 4. Composition rules (bundle priority)

Assessment order in `assessDmTrustWarning()` — **first match wins** for bundle ID; all active signals still listed.

| Priority | Bundle ID | Required signals | Default tier |
|----------|-----------|------------------|--------------|
| 1 | `BUNDLE_FIN_COLD` | `contact.cold` + (`thread.pivot_financial` \| `thread.financial_pressure`) | elevated; **critical** if `commerce.urgency_pressure` |
| 2 | `BUNDLE_PHISH_COLD` | `contact.cold` + (link suspicious \| lookalike \| risky attachment) | elevated; **critical** if urgency |
| 3 | `BUNDLE_SE_COLD` | `contact.cold` + any SE pattern signal | elevated; **critical** if urgency or SE_CRITICAL set |
| 4 | `BUNDLE_CONN_BURST` | `contact.cold` + `connection.request_burst` | elevated |
| 5 | `BUNDLE_SPAM_COLD` | `contact.cold` + `msg.rate` | elevated |
| 6 | Standalone SE signals | any SE standalone (accepted or cold) | elevated; **critical** if SE_CRITICAL |
| 7 | Rate / fanout alone | `msg.rate` \| `invite.fanout` | see §5 |
| 8 | Residual singles | lookalike, risky attachment, pivot financial, etc. | info or elevated per signal |

**SE_CRITICAL signals** (standalone → critical when urgency co-occur):  
`thread.credential_harvest`, `thread.remote_access_tool`, `thread.hiring_trap`, `thread.gift_card_scam`.

---

## 5. Weak-signal policy (composition over detection)

### 5.1 Principle

> **Weak signals inform; strong bundles warn.**

| Signal strength | Examples | Policy |
|-----------------|----------|--------|
| **Weak** | `msg.rate`, lone `thread.pivot_financial`, lone `link.suspicious_url` | Downgrade or suppress unless compounded |
| **Medium** | SE patterns without cold, financial on accepted peer | Usually `info` |
| **Strong** | Cold + financial + urgency; cold + credential harvest; L4 secret paste | `elevated` / `critical` / block |

### 5.2 `msg.rate` (TRUST-INT-1a — shipped)

| Parameter | Standard value | Notes |
|-----------|----------------|-------|
| `MSG_RATE_WINDOW_MS` | **120_000** (2 min) | Rolling inbound window |
| `MSG_RATE_THRESHOLD` | **18** | Base (cold / vigilant uses sensitivity scale) |
| `ACCEPTED_PEER_MSG_RATE_FLOOD_MULTIPLIER` | **2.5** | Accepted + not cold: threshold = ceil(18 × 2.5) = **45** |
| Rate-only + accepted + not cold | tier **`info`** | Not elevated |

**Sensitivity scaling** (`contact-trust-sensitivity.ts`):

| Posture | `msgRateThreshold` (approx.) |
|---------|------------------------------|
| Relaxed | 27 |
| Standard | 18 |
| Cautious | 12 |
| Vigilant | 9 (+ force cold) |

**Counting owner:** `use-dm-kernel-trust-banner.ts` uses `max(peerWideCount, threadCount)` over `MSG_RATE_WINDOW_MS`.

### 5.3 Future weak-signal rules (TRUST-INT-1b — not yet implemented)

| Rule ID | Proposal |
|---------|----------|
| **WS-1** | Accepted peer: suppress `msg.rate` entirely unless flood tier **and** (urgency \| financial \| link) |
| **WS-2** | Lone `thread.pivot_financial` on accepted peer → `none` (already info today — confirm) |
| **WS-3** | Require ≥2 independent classes (B+C, D+E, etc.) for `elevated` on accepted peers |

Implement only with corpus fixtures proving no regression on cold-contact attacks.

---

## 6. Contact trust sensitivity overlay

After base assessment, `applyContactTrustSensitivityToAssessment()` may:

| Policy flag | Effect |
|-------------|--------|
| `forceColdContact` (vigilant) | Treat accepted peer as cold |
| `suppressColdContact` (relaxed) | Downgrade `BUNDLE_FIN_COLD` without urgency → info |
| `elevateInfoToElevated` (vigilant) | Promote selected warning shapes from info → elevated |

Sensitivity is **recipient-local** and does not change connection accept/remove state.

---

## 7. ASE integration map

DM trust banner = **L1 Warn**. ASE modules = **L2–L4** at action boundaries.

| ASE module | Friction | Shared signals (target) |
|------------|----------|-------------------------|
| M1 Secret-input firewall | L4 | nsec patterns (independent) |
| M2 Identity binding | L2 | `contact.cold`, first accept |
| M3 Send ceremony | L2 | `contact.cold`, first DM |
| M4 Link safety | L1–L2 | `link.*` |
| M5 Conversation risk | L1–L3 | **Same `TrustSignalId` set** — no duplicate regex |
| M8 Contact-request sandbox | L2–L4 | `connection.request_burst`, pending state |

**Integration rule (TRUST-INT-2):** Export `assessDmTrustWarning()` (or a thin `assessActionFriction(input)` wrapper) for send/export/accept gates. Components **must not** reimplement phrase regex.

---

## 8. Owner map

| Concern | Owner | Forbidden elsewhere |
|---------|-------|---------------------|
| Signal detection | `dm-kernel-trust-*-signals.ts` (incl. `dm-kernel-trust-structural-signals.ts`) | Thread components, ASE UI |
| Tier / bundle composition | `dm-kernel-trust-assessment-port.ts` | — |
| Copy key resolution | `dm-kernel-trust-copy-keys.ts` | Inline i18n keys in banner |
| Peer rolling aggregates | `dm-kernel-trust-peer-state.ts` | Banner hook counting ad hoc |
| Banner lifecycle | `use-dm-kernel-trust-banner.ts` | — |
| Regression fixtures | `dm-kernel-trust-threat-corpus.ts` | Ad hoc test strings |
| Settings education | `trust-settings-panel.tsx` | — |
| Locale pattern packs | `dm-kernel-trust-social-engineering-locale-packs.ts` (+ en base in `dm-kernel-trust-social-engineering-signals.ts`) | — |
| Metadata signals (WoT, fanout) | `dm-kernel-trust-metadata-signals.ts`, `dm-kernel-trust-attachment-fanout-state.ts` | — |
| ASE assess enrichment | `dm-kernel-trust-assess-context.ts` | Per-gate metadata duplication |

---

## 9. Phased delivery

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| **TRUST-INT-1a** | `msg.rate` tuning + composition doc | **Done** — L1 green; corpus `spam_accepted_normal_burst_suppressed` |
| **TRUST-INT-1b** | Structural expansion: mixed-script host, OTP digit runs, punycode corpus | **Done** — `dm-kernel-trust-structural-signals.ts` |
| **TRUST-INT-1c** | Locale packs: `es`, `zh` SE patterns | **Done** — `dm-kernel-trust-social-engineering-locale-packs.ts` |
| **TRUST-INT-1d** | Metadata signals: `key.age`, WoT distance, fanout hash | **Done** — `dm-kernel-trust-metadata-signals.ts`, `dm-kernel-trust-attachment-fanout-state.ts` |
| **TRUST-INT-2** | ASE M4/M5 consume assessment port | **Done** — `dm-kernel-trust-assess-context.ts` enriches all ASE gates; send ceremony, link-open, chat + vault export, request junk routing, accept-dialog trust warning |

**Forbidden:** Per-screen keyword checks; server-side body scoring; delivery blocking on tier.

---

## 10. Threat corpus discipline

Every tuning change **must**:

1. Add or update fixtures in `dm-kernel-trust-threat-corpus.ts`
2. Run `dm-kernel-trust-threat-corpus.test.ts`
3. Record dogfood false positives as named cases (`spam_accepted_normal_burst_suppressed`, etc.)

Corpus categories: `financial`, `phish`, `urgency`, `spam`, `coordination`, `social_engineering`.

---

## 11. UX copy rules

| Surface | Rule |
|---------|------|
| Banner title | “Trust notice” — not “Scam detected” |
| Signal bullets | Show signal-specific i18n keys (`messaging.trust.signal.*`) |
| Footer | Reinforce I1/I2: recipient-local; never blocks delivery; sender not notified |
| Residual uncertainty | “This can be normal in active chats — verify identity if anything feels off.” |

Update signal copy when thresholds change (e.g. msg.rate → “last 2 minutes”).

---

## 12. Proof plan

| Layer | Command / scenario |
|-------|-------------------|
| **L1** | `pnpm verify:trust-int-l1` |
| **L2** | Dev-lab trust matrix + threat corpus fixtures (in L1 gate) |
| **L3** | [trust-int-l3-verification-2026-07.md](./trust-int-l3-verification-2026-07.md) — maintainer desktop dogfood |
| **L4** | Same runbook §4 — trust panel + banner + ASE confirm GIF |

---

## 13. Out of scope

| Item | Reason |
|------|--------|
| LLM / cloud NLP scoring | Violates I3/I7 and product privacy posture |
| Automatic message deletion | Violates I1 |
| Cross-user reputation database | Violates I3/I7 |
| Ideology keyword blocking | Violates I6 |
| ASE-1d contact-request sandbox reliability | Separate band — siloed until spec proof |

---

## 14. References

| Document | Role |
|----------|------|
| [trust-non-ai-intelligence-investigation-2026-07.md](./trust-non-ai-intelligence-investigation-2026-07.md) | Problem + evidence |
| [antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md) | L0–L4 friction catalog |
| [02-warning-and-trust-model.md](../../docs/archive/greenfield/02-warning-and-trust-model.md) | Concept-phase signal catalog |
| `apps/pwa/app/features/dm-kernel/dm-kernel-trust-assessment-port.ts` | Runtime composer |
