# Charter — sovereign communication (greenfield)

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19 (security & scope pass)

---

## Origin (why this exists)

Build communication that:

- Is isolated from default real-world identity binding (no email/phone as account root).
- Reduces scam and surveillance risk for users who cannot trust centralized identity graphs or data brokers.
- Protects legitimate users through **protocol and client intelligence**, not human content moderation or sender punishment.
- Does **not** exist to facilitate illegal trade; warns recipients when behavioral and contextual signals indicate elevated risk (including any financial solicitation).

Obscur validated client architecture and modular monorepo discipline; it did not validate public-relay community membership as product truth. This charter assumes a **greenfield** implementation.

---

## Ranked principles (conflict resolution)

When two goals conflict, the **lower number wins**.

| Rank | Principle |
|------|-----------|
| 1 | User holds cryptographic keys; infrastructure sees ciphertext and agreed metadata only |
| 2 | No legal-identity gate required to use the product |
| 3 | Local-first UX — app usable offline; sync is enhancement |
| 4 | **Recipient sovereignty** — warnings inform Party B only; no sender notices; no automatic enforcement |
| 5 | **Neutrality** — no removal of messages or groups based on opinion, hobby, or political content |
| 6 | **Behavior-based protection** — risk signals from observable events, not keyword lists or language models as global police |
| 7 | **No in-app finance** — no trading, wallets, escrow, or payment rails; financial *mentions* trigger recipient warnings only |
| 8 | Decentralization where it reduces operator power — user-chosen or self-hosted **couriers**, not “zero servers everywhere” |
| 9 | **Pragmatic encryption** — E2EE where it matters (bodies); do not break DM, sync, or groups for maximal encryption theater |
| 10 | **Scope honesty** — responsible only for **our** product and code; user protection is **limited** and documented |

---

## Security posture (summary)

Full spec: [05-security-data-classes.md](./05-security-data-classes.md).

- **Scorched earth** for message plaintext and keys on infrastructure (classes A/B).
- **Bounded metadata** (C/D) for delivery, groups, and rates — minimized, TTL’d, never merged into ad profiles.
- **Local utility** for search and rich analysis — server does not index decrypted chat.
- **Critical functions preserved:** private messaging, networking/sync, and group chat remain fully usable; encryption is not used to block core UX.

Scope and protection limits: [06-scope-of-responsibility.md](./06-scope-of-responsibility.md).

---

## Product promises

We **do** promise:

- E2EE messaging with honest limits documented.
- User-initiated block, leave, mute, and trust settings — always available.
- Transparent, versioned **rule packs** for warnings (reproducible on any conforming client).
- Optional trust markers (e.g. verified channel, WoT depth) — never mandatory for basic use.
- Anti-fraud affordances: rate limits, invite economics, recipient-side behavioral alerts.

We **do not** promise:

- Comprehensive or guaranteed safety — help and protection are **limited** (warnings, E2EE on our stack, user controls).
- Security of third-party relays, clients, or misconfigured self-hosts.
- Perfect bot elimination without any user friction cost.
- Detection of all illicit activity in all languages via keywords.
- Global unsend or erasure of all third-party copies.
- That the network prevents off-platform payments (warnings only at conversation layer).
- WhatsApp-scale growth, app-store “we read everything” moderation, or ad-supported free tier.

---

## Moderation model (normative)

| Action | Allowed? |
|--------|----------|
| Delete or hide messages server-side | **No** |
| Warn sender | **No** |
| Auto-ban, throttle, or intercept delivery | **No** (unless user explicitly configures a personal rule) |
| Notify recipient with analytical assessment | **Yes** |
| User blocks / leaves / ignores | **Yes** (user-initiated only) |

**Rigor** means: published signal catalog, versioned thresholds, reproducible scores, documented false-positive budget, no covert enforcement path from warning tier to delivery drop.

**Illicit organizing** (e.g. trade in stolen data, weapons, drugs as commercial operation): recipient warnings from **behavior bundles** and **local content-shaped features on Party B’s device** — never a central “illegal word” list.

**Financial activity:** any detected solicitation or payment request (fiat or cryptocurrency, any stated motive) contributes to recipient warning context. No in-app payment execution.

---

## Identity model

- Root identity = **cryptographic key material** (profile/device keys).
- Display names and avatars are **claims**, not proof.
- New keys are **easy by design** (safety for victims and whistleblowers).
- Abuse at scale is made **expensive** via rates, invites, WoT, optional attestations, and optional economic costs — not via mandatory government ID.

---

## Infrastructure stance

“No centralized official server” means:

- No global operator that owns identity graphs, plaintext, or ad profiles.
- **Does** allow: user-selected **courier** (sync + signed directory metadata), self-hosted or vendor-hosted, E2EE by default.

Nostr and other protocols may appear later as **optional transport adapters**, never as membership authority.

---

## Non-goals (v1)

- Public contact-upload discovery (“people you may know” from address book).
- In-app cryptocurrency, NFTs, tipping rails, or marketplace.
- Human moderation queue reading DMs.
- Global reputation empire or default blocklist operated by vendor.
- Competing with Telegram/WhatsApp on full feature parity in year one.

---

## Success definition (program level)

| Phase | Success |
|-------|---------|
| 1 | Two devices: QR contact → E2EE DM, block works, no stranger DM without invite artifact |
| 2 | Small group: join/leave roster converges on both devices within SLA; no relay-as-DB |
| 3 | Warning engine: scam fixtures trigger recipient alerts; benign financial chat stays low-noise |
| 4 | Optional federation adapters behind TransportPort |
| 5 | One documented install path for non-developers |

Commercial success is **optional** and not required for technical success; sustainability may be self-host kits or paid courier hosting without data sales.

**Program completion** = phases implemented per specification and exit gates passed — not universal fraud elimination or market dominance.
