# Trust defense v2 — recipient-local abuse assistance

**Status:** **Active** — native SEC-F iteration resumed in Obscur (2026-06-17); Anti-SE Shield remains a sibling reference only  
**Owner:** Maintainer  
**Design:** [design-goals-and-constraints.md](./design-goals-and-constraints.md) · [02-warning-and-trust-model.md](../archive/greenfield/02-warning-and-trust-model.md)

---

## External anti-SE app (maintainer intent, 2026-06-17)

Obscur keeps the **shipped v1.9.5 baseline** and continues **native** rule-pack iteration in-repo. A **standalone Anti-SE Shield** project explores freelance-first web protection in parallel — design reference only, not a dependency.

**Sibling project (distinct product, mutual reference):** [Anti-SE Shield](https://github.com/Dendro-X0/ase-shield) — vision [PRODUCT_VISION.md](https://github.com/Dendro-X0/ase-shield/blob/main/docs/PRODUCT_VISION.md), cross-reference [anti-se-shield-mutual-reference.md](./anti-se-shield-mutual-reference.md).

**Optional future alignment (never required):**

| Principle | Detail |
|-----------|--------|
| **One assessment owner** | Single `assessDmTrustWarning` (or thin adapter) — no parallel React retry chains |
| **Recipient-local** | Assess after decrypt on device; sender never notified; delivery invariant unchanged |
| **Lightweight** | Shared fixtures or rule IDs as documentation — native implementation remains default |
| **Explicit charter** | Integration test gate before replacing embedded detectors |

**Current native slice (2026-06-17):**

| Signal / bundle | Purpose |
|-----------------|---------|
| `thread.financial_pressure` | Cold contact + payment language **outside** early pivot window → `BUNDLE_FIN_COLD` |
| `thread.off_platform_redirect` | Move conversation off Obscur (Telegram, WhatsApp, etc.) → `BUNDLE_SE_COLD` when cold |
| `thread.advance_fee_scam` | Upfront fee / equipment purchase pressure → `BUNDLE_SE_COLD` when cold |
| `thread.remote_access_tool` | AnyDesk, TeamViewer, RustDesk, etc. → critical SE tier |
| `thread.overpayment_refund` | Overpayment / refund-difference scam → `BUNDLE_SE_COLD` when cold |
| `thread.fake_escrow` | Custom escrow / off-platform payment portal → `BUNDLE_SE_COLD` when cold |
| `thread.hiring_trap` | Run repo / install client for fake skills test → critical SE tier |
| `thread.irreversible_payment_demand` | Crypto-only / wire-only payment rails → `BUNDLE_SE_COLD` when cold |
| `link.lookalike_brand` | Typosquat / deceptive brand hostname on extracted URLs → `BUNDLE_PHISH_COLD` when cold |
| `attachment.risky_filename` | Double extension, macro Office, executable filenames → `BUNDLE_PHISH_COLD` when cold |

**v2.0f (2026-06-17):** Sealed **group** chats assess the latest inbound **sender** (per-sender thread state key). Banner copy is **signal-specific** via `dm-kernel-trust-copy-keys.ts` (attachment, lookalike, remote access, etc.).

---

## Product contract

Obscur is a **decentralized, E2EE** messenger. It is **not** affiliated with law enforcement and has **no legal authority** to stop user activity.

**Distinctive intent (maintainer, 2026-06-17):** Obscur targets a combination we have not seen elsewhere at product scale—**decentralization**, **ultimate privacy**, and **integrated recipient-local security** in one native client, **without** centralized servers, remote oversight, or collecting private user data under the guise of protection. The defense module is a **native, adaptable** component scoped to **information exchange** (DMs and sealed group chats), not a fork of [Anti-SE Shield](./anti-se-shield-mutual-reference.md).

This module provides **limited, recipient-local protection** within that framework:

| We assist | We do not |
|-----------|-----------|
| Warn about scam/phish/spam *shapes* | Moderate, ban, or delete on behalf of a vendor |
| Rate-limit and gate bots on operator infrastructure | Phone home scores or plaintext NLP |
| Let users dismiss, block, mute, leave | Keyword ideology filters across message bodies |

**B2B honesty:** Defensive signals + deployer-controlled abuse resistance — not “illegal content prevention.”

---

## Targets (priority order)

| # | Target | Layer | v2 slice |
|---|--------|-------|----------|
| 1 | **Phishing** | dm-kernel | **v2.0a** — `BUNDLE_PHISH_COLD` (**landed** 2026-06-17) |
| 2 | **Scams** | dm-kernel | v1.9.5 — `BUNDLE_FIN_COLD` |
| 3 | **Spam** | dm-kernel + inbox | **v2.0b partial** — `BUNDLE_CONN_BURST` anti-abuse convergence (**landed** 2026-06-17) |
| 4 | **Bots** | workspace / SEC-B | v1.9.5 — steward inbound gates |
| 5 | **Troll floods** | connection + DM rate | v2.0b — explicit flood policy |

---

## Detection philosophy

**No keyword filtering** on message prose (multilingual, obfuscation, false positives).

Use **structure and behavior**:

- Relationship context (`contact.cold`)
- Timing pivots (`thread.pivot_financial` window)
- URL / link class (IP literal, punycode, shorteners, credential-path shapes)
- Traffic shape (`msg.rate`, `invite.fanout`)
- Steward bot policy (allowlist, caps)

Financial *identifiers* (addresses, currency symbols) are structural — not ideology keywords.

---

## Rule pack v2 (embedded → extracted)

| Version | Bundles | Status |
|---------|---------|--------|
| **v1** | `BUNDLE_FIN_COLD`, `BUNDLE_SPAM_COLD` | Shipped SEC-F |
| **v2.0a** | + `BUNDLE_PHISH_COLD` (`contact.cold` + `link.suspicious_url`) | **Landed** — `dm-kernel-trust-link-signals.ts` |
| **v2.0b** | + troll flood tiers, connection anti-abuse convergence | **Partial landed** — `BUNDLE_CONN_BURST` |
| **v2.1** | Extract to `signals.json` / `bundles.json`; operator pin | Planned |

**Invariants (never break):**

1. Delivery — warning never blocks arrival unless user opts into local filter (future).
2. Sender silence — Party A never notified.
3. Neutrality — no political/religious/illegal-substance word lists.
4. Recipient-local — assess after decrypt on B’s device only.

---

## Bundle catalog (v2.0a)

| Bundle | Required signals | Tier |
|--------|------------------|------|
| `BUNDLE_FIN_COLD` | cold + financial pivot | elevated / critical + urgency |
| `BUNDLE_PHISH_COLD` | cold + suspicious URL class, lookalike brand host, or risky attachment filename | elevated / critical + urgency |
| `BUNDLE_CONN_BURST` | cold + connection request burst snapshot | elevated |
| `BUNDLE_SPAM_COLD` | cold + high msg.rate | elevated |
| `BUNDLE_SE_COLD` | cold + credential / authority / gift-card / off-platform / advance-fee SE signals | elevated / critical |

**Signal:** `thread.financial_pressure` — cold contact financial mention after pivot window expires (still `BUNDLE_FIN_COLD`, not info-only).

**Signal:** `link.suspicious_url` — any extracted URL matches structural phish shape (IP host, `xn--`, known shortener domain, credential-path segment). **Not** message-body keyword scan.

---

## Explicit non-goals

- Law-enforcement reporting or takedown workflows
- CSAM / child-safety scanning inside E2EE client
- Global blocklists or vendor moderation
- Keyword blacklists for “illegal” topics
- Text-only impersonation without URL/metadata (deferred v2.1 `BUNDLE_IMPERSON`)
- Remote signed rule-pack CDN (v2.1+)

---

## Verification

| Gate | Covers |
|------|--------|
| `pnpm verify:trust-v1.9.5` | Port + corpus + link + connection-burst convergence |
| Dev Lab `trust-matrix` | TRUST-1..6 + SPAM-1 scripted matrix rows (includes per-contact sensitivity TRUST-5/6) |
| Phase B TRUST-1..6, SPAM-1 | Dev Lab primary; manual UI optional |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial v2 scope — five targets, phish bundle v2.0a |
| 2026-06-17 | Per-contact defense sensitivity (relaxed/standard/cautious/vigilant); TRUST-5/6 matrix rows |
