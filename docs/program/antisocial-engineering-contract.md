# Antisocial-engineering contract

**Purpose:** Human-layer defenses when Obscur’s technical moat pushes attackers toward **deception, urgency, and credential harvesting** instead of offline brute force.

**Status:** Approved program contract (2026-07-10)  
**Band:** `ASE-1` — **ACTIVE** (parallel to `KEY-MOAT-1`)  
**Technical pairing:** [private-key-technical-moat-2026-07.md](../../specs/backend/private-key-technical-moat-2026-07.md)  
**Modular discipline:** [modular-iteration-contract.md](./modular-iteration-contract.md)

_Last updated: 2026-07-10_

---

## 1. Core thesis

| Principle | Meaning |
|-----------|---------|
| **Technology sets the floor** | Strong KDF, encryption-at-rest, and secret-input firewalls make Hashcat and disk theft the hard path |
| **Humans set the ceiling** | Passphrase entry, “confirm send,” and export approvals are where phishing wins |
| **Friction is a feature** | High-risk actions earn **visible, explainable delays** — not hidden annoyance |
| **Never blame the user** | Copy teaches; modules intercept; defaults protect |

Obscur will **never** ask for a private key, recovery phrase, or passphrase outside the canonical unlock/import flows. All modules reinforce that invariant in UI copy and behavior.

---

## 2. Threat scenarios

### 2.1 Primary attack paths (modern)

| ID | Scenario | Attacker goal | User mistake |
|----|----------|---------------|--------------|
| **SE1** | Fake support / “verify your account” | Harvest passphrase or nsec | Paste secret into chat or web form |
| **SE2** | Impersonation (lookalike name + avatar) | Trick send to wrong person | Trust display name over fingerprint |
| **SE3** | Urgent DM (“send code now”) | Exfiltrate OTP / friend code / key | Act under time pressure |
| **SE4** | Malicious link (“unlock wallet here”) | Drive to credential form | Click off-platform unlock |
| **SE5** | Contact substitution | Replace pubkey in pasted blob | Accept unsigned hex without verification |
| **SE6** | Export / backup scam | User exports raw key to “helpful” tool | Export without understanding |
| **SE7** | Deep-link hijack | Open app with attacker-controlled token | Tap link from untrusted source |

### 2.2 Out of scope (honest limits)

| Scenario | Why |
|----------|-----|
| Compromised OS / malware while unlocked | T8 — technical moat documents memory limit |
| User verbally gives passphrase to attacker | No software prevents voluntary disclosure |
| Nation-state physical coercion | Out of product scope |

---

## 3. Defense model — friction levels

```text
L0  Inform     — copy + education at sensitive surfaces
L1  Warn        — non-blocking banner; user can proceed
L2  Confirm     — explicit modal; show fingerprints / npub
L3  Step-up     — second factor, delay, or OOB verify
L4  Block       — hard refuse (nsec in search, invalid signing target)
```

**Rule:** Escalate friction with **risk score**, not with every click.

### 3.1 Risk score inputs (v1 heuristic)

| Signal | Weight |
|--------|--------|
| First message from unknown contact | +2 |
| Message contains URL + urgency words | +2 |
| Request mentions “seed,” “private key,” “recovery” | +3 |
| New contact + immediate payment/invite action | +3 |
| Pasted material looks like nsec / 64-hex private scalar | +4 (→ L4) |
| Contact card signature invalid | +4 (→ L4) |

Scores ≥ 5 → L2 confirm · ≥ 8 → L3 step-up · secret patterns → L4 block.

---

## 4. Module catalog

Each module is a **single owner** service consumed by feature UI — no duplicate heuristics in components.

### 4.1 M1 — Secret-input firewall (shared with KEY-MOAT-1)

| Field | Value |
|-------|-------|
| **Owner** | `secret-input-firewall.ts` (planned) |
| **Level** | L4 block / L1 warn |
| **Surfaces** | Discovery, chat compose, import, profile fields, export |
| **Behavior** | Reject `nsec`/`ncryptsec`; relay-disambiguate hex; warn on clipboard paste of secrets |

**Status:** Discovery slice **landed** — chat, profile, invitation, contact-request, and settings export gate **landed** (2026-07-10).

### 4.2 M2 — Identity binding panel

| Field | Value |
|-------|-------|
| **Owner** | `identity-binding-presenter.ts` · `identity-binding-panel.tsx` |
| **Level** | L2 confirm |
| **When** | Add contact, first DM to unknown, accept invite |
| **Shows** | Display name **and** npub fragment, friend code, avatar hash, resolver source |
| **Rule** | Never trust attacker-supplied label alone |

**Status (2026-07-10):** **Implemented** — `identity-binding-presenter.ts`, `identity-binding-panel.tsx`, wired to Add Friend + connection request accept

### 4.3 M3 — Signing / send ceremony

| Field | Value |
|-------|-------|
| **Owner** | `send-ceremony-gate.ts` · `send-ceremony-dialog.tsx` · `use-chat-actions.ts` |
| **Level** | L2–L3 |
| **When** | First message to new pubkey; export backup; change recovery password |
| **Shows** | “You are sending as {npub} to {recipient npub}” |

**Status (2026-07-10):** **Implemented** — first DM to unknown peer gates send in `use-chat-actions`; L2 `SendCeremonyDialog` in main shell

**Note:** M3 is **sender identity confirm**, not recipient accept. Recipient-gated contact requests are **M8 / ASE-1d**.

### 4.8 M8 — Contact-request sandbox

| Field | Value |
|-------|-------|
| **Owner** | `contact-request-sandbox-policy.ts` (planned) · `request-transport-service.ts` · `use-requests-inbox.ts` · `dm-receive-pipeline` |
| **Level** | L2 confirm on accept · L4 block on attachments/scripts in pending |
| **When** | Any first contact; entire `pending` handshake |
| **Shows** | Requests tab only; identity binding; Accept / Decline; sandbox Q&A thread |

**Status (2026-07-11):** **Design** — [dm-contact-request-sandbox-2026-07.md](../../specs/backend/dm-contact-request-sandbox-2026-07.md)

### 4.4 M4 — Link and domain safety

| Field | Value |
|-------|-------|
| **Owner** | `link-safety-analyzer.ts` (planned) |
| **Level** | L1 warn → L2 for credential-shaped URLs |
| **Behavior** | Flag off-platform “unlock,” “seed,” “wallet verify” paths; never auto-open external auth |

### 4.5 M5 — Impersonation / urgency heuristics

| Field | Value |
|-------|-------|
| **Owner** | `dm-kernel-trust-assessment-port.ts` · `dm-kernel-trust-social-engineering-signals.ts` (canonical); ASE gates consume same port (TRUST-INT-2) |
| **Level** | L1–L3 |
| **Behavior** | Compound `TrustSignalId` bundles; surface calm copy (“Obscur never asks for your passphrase”) |
| **Design** | [trust-non-ai-intelligence-design-2026-07.md](../../specs/backend/trust-non-ai-intelligence-design-2026-07.md) |

**Status (2026-07-11):** **Done** — DM banner (L1) + ASE action gates consume `dm-kernel-trust-assess-context.ts` / assessment port (TRUST-INT-2).

### 4.6 M6 — Out-of-band confirmation (OOB)

| Field | Value |
|-------|-------|
| **Owner** | `oob-confirmation-service.ts` (planned) |
| **Level** | L3 |
| **When** | Export identity, add high-trust contact, disable lock |
| **Methods** | QR compare on second device; pre-shared friend code check; optional manual fingerprint compare |

### 4.7 M7 — Recovery literacy (persistent copy)

| Field | Value |
|-------|-------|
| **Owner** | i18n keys + lock/import screens |
| **Level** | L0 |
| **Copy invariant** | “Obscur staff will never ask for your passphrase or private key.” |

---

## 5. UX principles

1. **Explain why** — every friction modal states the risk in one sentence.
2. **Show fingerprints** — npub prefix/suffix, friend code, signed card status.
3. **No shame** — “This looks like a private key” not “You made a mistake.”
4. **Prefer signed channels** — QR contact cards and friend codes over raw hex.
5. **Default safe** — block beats warn when cryptographic certainty exists (nsec format).

---

## 6. Integration with technical moat

```text
KEY-MOAT-1 (offline / crypto)          ASE-1 (online / human)
─────────────────────────────          ────────────────────────
Argon2id + encrypted blob      →     Passphrase only on unlock screen
Secret-input firewall          →     M1 shared module
Native signing                   →     M3 send ceremony shows pubkey
NIP-49 export                    →     M6 OOB before plaintext export
Rate limit / lockout            →     M7 literacy on lockout screen
```

Neither band replaces the other. **Ship M1 with KEY-MOAT Phase 1**; remaining modules follow ASE phases below.

---

## 7. Phased delivery

| Phase | Modules | Exit criteria |
|-------|---------|---------------|
| **ASE-1a** | M1 extend + M7 copy | **Done** — firewall surfaces + export gate + literacy on lock/import/settings |
| **ASE-1b** | M2 identity binding | **Done** — Add Friend + invite accept show fingerprint panel |
| **ASE-1c** | M3 send ceremony | **Done** — first DM to unknown requires L2 confirm |
| **ASE-1d** | M8 contact-request sandbox | Requests-only until accept; Q&A sandbox; offline compose policy |
| **ASE-2a** | M4 link safety | URLs in DMs flagged; no credential URL auto-open |
| **ASE-2b** | M5 risk scorer | Urgency + impersonation heuristics in thread UI — **see TRUST-INT-1** |
| **ASE-3** | M6 OOB | Export / high-trust flows support second-device confirm |

**Forbidden:** UI-only patches that duplicate heuristics per screen — use shared owners.

---

## 8. Proof plan

| Layer | ASE evidence |
|-------|--------------|
| **L1** | Unit tests per module; risk score fixtures |
| **L2** | Storybook / component tests for binding panel + ceremonies |
| **L3** | Scripted scenarios: paste nsec in chat → blocked; fake support URL → warn |
| **L4** | Maintainer demo: add contact via friend code with binding panel visible |

---

## 9. Metrics (non-telemetry, local-only)

Product may record **aggregate counters locally** (no relay upload without explicit opt-in):

- `ase.secret_blocked_count`
- `ase.confirm_shown_count` / `ase.confirm_proceeded_count`
- `ase.link_warn_count`

Used for tuning friction — not for surveillance.

---

## 10. Register / handoff

| Band | Status | Next atomic step |
|------|--------|------------------|
| `ASE-1` | ACTIVE | ASE-1d — contact-request sandbox (Requests-only + Q&A until accept) |
| `TRUST-INT-1` | ACTIVE | L3/L4 dogfood per [trust-int-l3-verification-2026-07.md](../../specs/backend/trust-int-l3-verification-2026-07.md) (code L1 done) |
| `KEY-MOAT-1` | ACTIVE | Phase 5 — at-rest charter alignment (SQLCipher / vault) |

Update [current-session.md](../handoffs/current-session.md) when either band becomes the primary execution thread.

---

## 11. References

| Document | Role |
|----------|------|
| [private-key-technical-moat-2026-07.md](../../specs/backend/private-key-technical-moat-2026-07.md) | Technical moat phases |
| [trust-non-ai-intelligence-design-2026-07.md](../../specs/backend/trust-non-ai-intelligence-design-2026-07.md) | Non-AI trust composition (TRUST-INT-1) |
| [trust-non-ai-intelligence-investigation-2026-07.md](../../specs/backend/trust-non-ai-intelligence-investigation-2026-07.md) | False-positive evidence + owners |
| [discovery-friend-code-private-key-2026-07.md](../../specs/backend/discovery-friend-code-private-key-2026-07.md) | M1 Discovery slice |
| [v1.9.8-portable-storage-and-encryption-charter.md](./v1.9.8-portable-storage-and-encryption-charter.md) | T8 honest limits |
| [obscur-auth-kernel-charter-2026-06.md](./obscur-auth-kernel-charter-2026-06.md) | Unlock / signing planes |
| [design-goals-and-constraints.md](./design-goals-and-constraints.md) | Product intent |
