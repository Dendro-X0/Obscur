# Security model — data classes & pragmatic encryption

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19  
**Normative for:** All phases; Phase 0 required reading

---

## Security goal (not a perimeter fantasy)

Primary strategy: **make attacker targets worthless**, not build an “impenetrable wall.”

| Layer | Role |
|-------|------|
| **Scorched earth (A/B)** | Message bodies and keys have **no value** on courier, relay, or vendor DB |
| **Bounded exposure (C/D)** | Metadata and directory state exist for UX — **minimized, TTL’d, purpose-limited** |
| **Abuse economics** | Bots and spam cost friction (rates, WoT, invites) — see [03-identity-and-sybil.md](./03-identity-and-sybil.md) |
| **Recipient intelligence** | Warnings inform users; product does not claim omnipotent protection — see [06-scope-of-responsibility.md](./06-scope-of-responsibility.md) |

We do **not** claim protection against: compromised user devices, users ignoring warnings, off-platform payments, or motivated nation-state targeting of endpoints.

---

## Pragmatic encryption rule (critical functions)

> **Encryption serves the product; the product does not serve maximal encryption at the cost of core UX.**

These functions are **protected, not disabled**:

| Function | Requirement | Encryption stance |
|----------|-------------|-------------------|
| **Private messaging (1:1)** | Reliable send/receive, history, block | E2EE bodies; local plaintext index for search |
| **Networking / sync** | Deliver envelopes when online; degrade gracefully offline | Ciphertext on wire; minimal routing metadata |
| **Group chat** | Roster truth, join/leave, group E2EE | Signed directory (D) on courier; E2EE group keys; **no** relay-as-roster-DB |

**Forbidden tradeoffs:**

- Server-side plaintext index “for search” — breaks scorched earth for content.
- Delaying or blocking delivery based on vendor warning score — breaks recipient sovereignty.
- Requiring homomorphic/encrypted search on courier in v1–3 — defer; use **local FTS** instead.
- Refusing to store **any** directory metadata — breaks group convergence.

When E2EE and UX conflict, **resolve by data class and placement** (local vs courier), not by weakening E2EE of message bodies.

---

## Data classes A–D

Every field in the system must be classified at design time.

| Class | Name | Examples | On courier? | Value if stolen |
|-------|------|----------|-------------|-----------------|
| **A** | Secrets | Root keys, session keys, decrypted cache | **Never** | Total compromise |
| **B** | Ciphertext | Message envelopes, encrypted attachments | Yes (TTL/storage policy) | Worthless without A |
| **C** | Operational metadata | Timestamps, sizes, rate counters, delivery acks | Minimal + TTL | Traffic analysis; limited content insight |
| **D** | Directory metadata | Public keys, signed membership head, invite tokens | Yes (signed, auditable) | Membership graph; not message text |

### Handling rules

**A — Secrets**

- Generate and store on device; optional user-held encrypted backup.
- Never log, never telemetry, never crash reports with payload.

**B — Ciphertext**

- Default for all message bodies and attachments in transit/at rest on infrastructure.
- Courier cannot derive plaintext without client keys.

**C — Operational metadata**

- Collect minimum needed for delivery and anti-abuse rates.
- Default retention TTL (e.g. 7–30 days for ephemeral counters; document in privacy label).
- No enrichment into ad profiles or global behavior databases.

**D — Directory metadata**

- Signed by admin/member keys; clients verify before trust.
- Required for group roster convergence and invite flows.
- Breach exposes **who is in which group**, not **what was said**.

---

## Utility paradox (enterprise vs this product)

Banks and healthcare need **server-searchable plaintext registries** — data is the asset.

This product is **conversations**:

| Need | Solution | Server value |
|------|----------|--------------|
| Search my chats | Local FTS index on device | Zero |
| Cross-device search | Sync encrypted index or restore from user backup | Worthless without user key |
| Group membership | Signed directory (D) | Bounded |
| Fraud hints | Behavior events + local analyzers | No global plaintext store |

We explicitly **do not** optimize for enterprise registry search. We optimize for **worthless B on infrastructure** and **full utility on device**.

---

## Threat actors & responses

| Actor | Targets | Mitigation |
|-------|---------|------------|
| Passive network | B in transit | TLS + E2EE |
| Malicious courier | B, C, D dump | No A; B useless; minimize C; signed D |
| Relay operator (adapter) | Same as courier | Adapter is optional; not roster authority |
| Scammer / bot | User attention, off-app money | Rates, WoT, recipient warnings — [02-warning-and-trust-model.md](./02-warning-and-trust-model.md) |
| Compromised client | A on one device | OS security; user scope; no fleet master key |
| Curious vendor (us) | Must not target A | Architecture + audits; see [06-scope-of-responsibility.md](./06-scope-of-responsibility.md) |
| Third-party apps | N/A | **Out of scope** — we secure **our** client and courier reference |

---

## “Zero-knowledge” claims (precision)

Allowed claims:

- Infrastructure does not hold **message plaintext** or **user root keys**.
- Warning tier is **reproducible** from published rule packs and agreed inputs.

Disallowed claims:

- “We cannot see any metadata ever.”
- “Users are fully safe from all fraud.”
- “Government-proof” without endpoint compromise caveats.

---

## Phase mapping

| Phase | Security deliverable |
|-------|---------------------|
| 0 | This doc + threat fixtures; privacy nutrition label draft |
| 1 | E2EE DM; A never on courier; local message store |
| 2 | Signed D for groups; roster tests; no plaintext roster on relay |
| 3 | C minimization audit; rule pack supply chain |
| 4 | Adapter isolation tests — adapter off → Phases 1–2 hold |
| 5 | Published privacy label + security review checklist |

---

## Acceptance tests (security-specific)

| ID | Test |
|----|------|
| S-1 | Courier DB dump contains no class A and no decryptable class B |
| S-2 | Local search returns results with courier offline |
| S-3 | Group chat works with only D + B on courier (no plaintext bodies on server) |
| S-4 | Disabling “encrypted search on server” feature flag N/A — feature does not exist |
| S-5 | TTL job removes expired C counters (where implemented) |

Extend Phase 0 catalog when implementation repo is created.
