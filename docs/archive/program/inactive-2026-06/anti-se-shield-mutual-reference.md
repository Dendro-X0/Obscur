# Anti-SE Shield — mutual reference (Obscur)

**Status:** Active reference  
**Last updated:** 2026-06-17  
**Obscur repo:** `experimental-workspace/newstart`  
**Shield repo:** [github.com/Dendro-X0/ase-shield](https://github.com/Dendro-X0/ase-shield)

---

## Relationship

**Obscur** and **Anti-SE Shield** are **distinct initiatives**. They are **not** parent/child products, shared libraries, or merge candidates. Obscur may adopt **design principles** inspired by Shield; the codebases, products, and release trains remain **fully independent**.

The same maintainer works on both; they **mutually reference** insights while shipping **separate** Anti-SE implementations.

| | Obscur | Anti-SE Shield |
|--|--------|----------------|
| **What it is** | Decentralized E2EE messenger | Browser extension + Windows companion |
| **Anti-SE** | Native dm-kernel / SEC-F module (own codebase) | `@ase/rules` + extension/companion |
| **Primary focus** | **Information exchange** — DMs and sealed group chats | **Freelance-first** public-web protection |
| **Adaptability** | Native module tuned to conversation context, relationship state, and E2EE constraints | Broad web surfaces + Phase 2 containment (quarantine, sandbox) |
| **Coupling** | None required | None required |

---

## Obscur defense — distinctive positioning (maintainer intent)

Obscur’s native defense module is **more adaptable within its domain** than a browser extension can be for private messaging: it runs **inside** the app that owns decrypt, thread history, cold-contact context, and group membership—without routing message content through a vendor “protection” backend.

**What makes the combination unusual:**

- **Decentralized transport** — users and deployers choose relays and infrastructure; no Obscur-operated moderation plane.
- **Ultimate privacy** — E2EE by design; assessments run **recipient-local after decrypt**, not on a central NLP or scoring service.
- **Integrated security without centralized oversight** — warnings and optional gates are **on-device assistance**, not remote policy enforcement or surveillance marketed as safety.
- **No private-data collection for “protection”** — Obscur does **not** harvest message bodies, contact graphs, or behavioral scores to a central server under the guise of user protection.

**Scope boundary:** Obscur assists at **information-exchange surfaces** (direct messages, group chats). Shield explores **public web + desktop containment** (downloads, quarantine, remote-session guard). Complementary problems; neither product subsumes the other.

**Shield vision:** [PRODUCT_VISION.md](https://github.com/Dendro-X0/ase-shield/blob/main/docs/PRODUCT_VISION.md)  
**Shield ADR:** [ADR-007](https://github.com/Dendro-X0/ase-shield/blob/main/docs/decisions/ADR-007-obsucr-sibling-project.md)

---

## Why Shield exists (Obscur perspective)

Shield is **not** a substitute for Obscur’s native module. It is a parallel product that:

- Targets **freelance platforms** first—maintainer experience: ~**8/10** new contacts on marketplaces show scam or phishing behavior.
- Prototypes **web + desktop containment** (quarantine, sandbox, remote guard) that Obscur does not need in-app.
- Explores Anti-SE across **many online social surfaces** (marketplaces, email, forums, messaging web) on a faster iteration loop.

Obscur **continues** its own SEC-F / trust-defense path on the Obscur release train when chartered—see [trust-defense-v2-scope.md](./trust-defense-v2-scope.md).

---

## What Obscur keeps (native module)

- **v1.9.5** trust baseline — `pnpm verify:trust-v1.9.5`
- **dm-kernel** port: `assessDmTrustWarning`
- Detectors: `dm-kernel-trust-social-engineering-signals.ts` (credential harvest, authority impersonation, gift-card pressure)
- Future: Obscur-specific bundles (wallet, mnemonic, cold-contact context)—implemented **in Obscur**, not imported as a hard dependency

---

## Mutual reference (ideas, not code)

### Obscur → Shield

| Idea | Obscur source |
|------|----------------|
| Recipient-local only; sender not notified | trust-defense v2 contract |
| Structural signals vs keyword ideology filters | [design-goals-and-constraints.md](./design-goals-and-constraints.md) |
| Cold-contact / relationship context | dm-kernel bundles |

### Shield → Obscur

| Idea | Shield source |
|------|----------------|
| Freelance scam rule catalog R01–R12 | `@ase/rules` |
| Dev Lab + CI regression without live scammers | `packages/core/src/dev-lab.ts` |
| Adapter tiers: full / links-only / download-only | [PRODUCT_VISION.md](https://github.com/Dendro-X0/ase-shield/blob/main/docs/PRODUCT_VISION.md) |
| Thread → download → containment story | Companion quarantine + remote guard |

---

## Optional alignment (never required)

- Shared **synthetic fixture** text for manual or automated comparison.
- Aligned **rule IDs** where patterns overlap (e.g. remote-access, off-platform payment).
- Published **rule schema** as documentation only.

Obscur may adopt zero, some, or all—native implementation remains the default.

---

## Obscur SEC-F status

Native SEC-F iteration **resumed in Obscur** (2026-06-17). Shield continues in parallel; Obscur owns recipient-local DM assessment (`assessDmTrustWarning`). See [trust-defense-v2-scope.md](./trust-defense-v2-scope.md) and [current-session.md](../handoffs/current-session.md).

---

## Maintainer notes

- Product name in codebase: **Obscur** (also spelled Obsucr/Obuscr in conversation).
- **Freelance-first** is Shield’s wedge; Obscur’s wedge is **private E2EE trust**—complementary problems, same developer experience.
