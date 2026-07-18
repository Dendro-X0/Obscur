# Obscur — protocol identity & underground charter

**Status:** Canonical product track (2026-07-17)  
**Owner:** Maintainer  
**Audience:** Maintainer, fork adopters, operators, future protocol readers  
**Supersedes as north-star story:** “grow a consumer chat app / monetize OSS / win visibility against Signal–Slack”  
**Does not replace:** [design-goals-and-constraints.md](./design-goals-and-constraints.md) (invariants, phases) · [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md) (deployment model)

---

## One sentence

**Obscur is a protocol- and specification-level product for encrypted, sovereignty-preserving communication** — modular client and backend, dynamic transport integrability, engineered for high privacy standards and hostile environments. It is **not** a mass-market messenger competing on popularity, and **not** a financial blockchain product.

---

## Metaphor (how to judge success)

Popular music optimizes for reach. Obscur is **avant-garde engineering**: a complex artifact for a **select few** who need rigor under stress. Wide fame is optional. **Correctness under adversarial conditions is mandatory.**

| Popular-track metric | Obscur metric |
|----------------------|---------------|
| Downloads, stars, virality | Reproducible proof (L1–L4), fail-closed behavior |
| Feature parity with Slack / Signal | Spec completeness + separable kernel |
| Monetization / B2B funnel | Independence from platform landlords |
| “Everyone should use this” | “The people who need this can run it” |

---

## What Obscur is

| Layer | Meaning |
|-------|---------|
| **Protocol / specification** | Contracts for E2EE messaging, transport adapters, membership/coordination hooks, evidence of delivery — not “whatever the current UI does” |
| **Modular implementation** | Client (UI/shell) and backend (Rust kernel, persistence, crypto, native IPC) are **separable**; UI must not own durable or security-critical truth |
| **Dynamic integrability** | Pluggable transports (private WS/HTTP mesh, optional public Nostr, Tor policy) without rewriting the messaging kernel |
| **Uncompromising underground product** | No ads, no engagement funnel, no rented-trust default; optional adapters stay optional |
| **Technical anarchy (defined)** | No single entity owns user data or access rights as a platform landlord; rules and keys are technical — see below |
| **Stress-first design** | Assume troll campaigns, malicious peers, hostile networks, and regulated environments — design for **asymmetric defense**, not happy-path demos alone |

**Reference implementation** (desktop Tauri + PWA shell + operator stack) proves the protocol. The product is the **protocol + rigorous reference**, not the brand volume.

---

## Identity, crypto, and “blockchain” (precise language)

Obscur aims for **highest practical encryption and privacy standards** in its threat class: E2EE for private content, local key custody, at-rest protection on native surfaces, and recipient-local defenses (ASE).

| Topic | Obscur truth |
|-------|----------------|
| **User identity** | **Asymmetric cryptography** — keypair sovereignty (Nostr-compatible `npub` / secret key patterns). Identity is **self-custodied keys**, not an account rented from a company |
| **Nostr** | **One optional transmission adapter** among private WS, HTTP mesh, hybrid, Tor — not the product definition |
| **Blockchain / ledger** | **Not used** for identity, messaging, or financial settlement. Platform pivot explicitly: decentralization ≠ blockchain ([platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)) |
| **Shared math with crypto culture** | Same *family* of public-key crypto as many blockchain systems (e.g. secp256k1 curves in Nostr-style keys) — that is **cryptography for privacy and authenticity**, not a payment chain or speculative token |

**Promotion rule:** Say **“cryptographic identity / key sovereignty.”** Do **not** say “blockchain identity” or “blockchain for privacy” — that invites financial-crypto confusion and illicit associations Obscur deliberately avoids. Financial processing lives elsewhere (e.g. Vectis anti-financial credits if at all) — **not** in Obscur.

### Technical anarchy (aligned with Vectis doctrine)

Means:

- No platform landlord that owns the message graph by default  
- No admin API that overrides user keys or private content  
- Operator-chosen infrastructure; users can exit and fork  

Does **not** mean:

- No servers anywhere  
- Immunity from law or physical coercion  
- “Anything goes” as a product feature  

---

## What Obscur is not

- A startup seeking product-market fit against commercial chat  
- A general-purpose public Nostr social client  
- A platform that monetizes attention or sells user graphs  
- “Signal but open source and free” for casual consumers  
- A promise of immunity from nation-state physical coercion  
- Dependent on wide public knowledge for legitimacy  
- An **“anti-censorship forum builder,” “dark web messenger,” or “gray-market hub”** — those labels are inaccurate product framing and make legitimate work look illicit  

Honest limits remain in [obscur-v2-known-limitations.md](./obscur-v2-known-limitations.md) and Vectis-style exit doctrine: parties can leave the stack; the protocol does not replace law.

---

## Promotion & messaging (underground, still public)

Promotion is allowed and planned (including video) even without a polished channel, blog, or editing craft. **Underground ≠ invisible.** The bar is **honest framing**, not silence.

### Do say

| Angle | Why |
|-------|-----|
| Encrypted communication protocol with a rigorous reference client | Matches what was built |
| Client and backend are separable; transports are pluggable | Technical differentiator without drama |
| Cryptographic identity — you hold the keys | Accurate; not “blockchain” |
| Nostr is optional; private / hybrid / Tor paths exist | Stops Nostr-only misread |
| Built for friends, clubs, and interest communities who want private spaces | Benign, legitimate scenarios (see below) |
| Recipient-local anti–social-engineering helps protect **legitimate users** | Distinctive; [antisocial-engineering-contract.md](./antisocial-engineering-contract.md) |
| Operators choose infrastructure; plaintext stays on devices | Accurate E2EE + private-trust story |

### Preferred promotion scenarios (deliberately benign)

Lead with ordinary, legitimate use — not threat theater:

| Scenario | Story |
|----------|--------|
| Friends’ private group | Invite-only chat among people who already know each other |
| Interest community | e.g. music enthusiasts sharing passion in a closed room |
| Small club / studio / lab | Operator runs a trusted relay; members use Obscur desktop |
| Privacy-conscious individuals | Cryptographic identity + optional Tor when needed |

These scenarios carry the **same architecture** that resists landlord capture; they do not require illicit framing.

### Do not say (or imply)

| Label / framing | Why it fails |
|-----------------|--------------|
| Dark web / onion-first product identity | Tor is an **optional policy**, not the brand |
| Gray-market / unregulated commerce hub | Illegitimates the project; not the design goal |
| “Anti-censorship forum builder” | Overclaims community/forum product shape |
| “Unlike WhatsApp/Telegram, we …” as the hook | Invites mass-market comparison games Obscur opts out of |
| “Blockchain identity / blockchain privacy” | Technically wrong for this repo; invites crypto-finance misread |
| “No one can see or stop anything — ever” | False (endpoints, metadata, OS compromise, physical coercion) |

### Comparison policy

Do **not** lead with feature scorecards against mainstream apps. If someone asks “vs X,” answer with **threat model and architecture** (E2EE client, operator transport, local ASE), then stop. Avant-garde work is not graded on pop charts.

### Structural honesty (without gray-market branding)

E2EE messaging on operator-chosen transports means **there is no central content police** — the same structural property large messengers have when their teams do not (or cannot) moderate private ciphertext. Obscur does **not** market that as a feature for illicit trade.

**Illicit actors will exist on any open tool.** Obscur does not pretend otherwise. The project response is:

1. **Elevate security protocols** continuously (crypto floor, transport integrity, ASE friction)  
2. **Safeguard legitimate users** without human content oversight (no rented moderation empire)  
3. **Curtail attackers’ ability to exploit builders and ordinary users** (phishing, urgency, key harvest) — not to police the world’s forums  

| Claim | True | False |
|-------|------|-------|
| No SaaS landlord reads your message plaintext by design | Yes | — |
| Recipient-local ASE can warn on phishing / urgency / key harvest patterns | Yes (scoped — ASE-1) | — |
| Cryptographic key identity (self-custody) | Yes | — |
| Blockchain ledger for identity or settlement | — | No |
| Obscur is built to host gray markets | — | No |
| Obscur guarantees a scam-free network | — | No |
| Central admins score and ban private content | — | No (by architecture) |

---

## Communities (ambition vs current delivery)

**Product ambition (charter-level):** A robust community system matters — private groups and interest communities are first-class legitimate scenarios. Long-term, larger communities (Telegram-scale rooms, Reddit-like interest spaces) may be desirable **if** they preserve encryption, sovereignty, and operator choice.

### Operator-sovereign scale (the feasible model)

Large communities do **not** require a global landlord or a public-relay gossip miracle. They require **capacity under user control**:

```text
Crowdfund / club / co-op buys high-capacity host
        ↓
Operator (the community) runs relay + coordination (+ optional mesh)
        ↓
Members use Obscur clients — E2EE, keys on devices
        ↓
Relative to Big Tech: decentralized (no corporate HQ owns the graph)
Relative to the deployment: intentionally centralized on *their* servers
```

| Concept | Meaning |
|---------|---------|
| **Decentralized vs the internet** | No single Silicon Valley entity owns access rights or message plaintext for all Obscur users |
| **Centralized under the community** | One (or few) high-capacity workspaces the members fund and govern — they hold authority over *their* platform |
| **Cryptographic sovereignty** | Even on a fat server, plaintext stays client-side; the operator moves ciphertext and metadata they choose to retain |
| **Crowdfunding / co-op host** | Legitimate path to Telegram-class headcount without becoming a SaaS landlord product |

This is **private-trust at scale** — the same architecture as a LAN team relay, with bigger hardware and clearer governance. It is **not** “blockchain decentralization” and **not** “no server anywhere.”

### Current engineering truth (do not overclaim in promotion)

| Surface | Status |
|---------|--------|
| Private / managed workspace on trusted infrastructure | Primary design path ([platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)) |
| Public-relay “global community roster truth” | Explicitly abandoned as primary story |
| Community feature band | **PAUSED** for open patching — see handoff / community relaunch docs |
| Thousands-of-members on **operator-owned** capacity | **Theoretically feasible** and charter-aligned; **not verified delivery** yet — needs community-system engineering + ops runbooks |

**Promotion rule today:** Demo friends’ groups and small interest communities on **private trust**. Frame scale as: *“Your community can grow on infrastructure you fund and control.”* Do not claim “better than Reddit at scale” until that path is designed, implemented, and proven under this charter’s encryption bar.

**Design stance when community work resumes:** Scale by **operator capacity and governance**, not by surrendering E2EE or key sovereignty. Prefer technical safeguards (ASE, crypto, evidence) over human content-police platforms. Illicit spaces may appear on any powerful host — response remains elevate security for legitimate members, not brand the product as gray-market.

---

## Threat posture (who we design against)

Assume at least one of:

1. **Targeted harassment** — coordinated troll / spam / social-engineering pressure on recipients  
2. **Malicious network actors** — hostile relays, MITM on clearnet paths, DoS on known endpoints  
3. **Regulatory / censored environments** — blocks on popular apps, DNS/TLS interference, forced clearnet-only paths  
4. **Untrusted operators** — servers that must never see plaintext (metadata honesty still required)

**Asymmetric methods** (direction, not a claim of completion):

| Pressure | Obscur response shape |
|----------|------------------------|
| Platform kill-switch | Operator-chosen transport; no single HQ server |
| Public-relay unreliability | Private trust stack as primary workspace path |
| Clearnet surveillance / blocks | Tor / onion policy (fail-closed when Tor required) |
| Spam / cold-contact abuse | Recipient-local trust + ASE friction; no central moderation empire |
| Social engineering / scam pressure | Limited ASE-1 module — protect legitimate users ([antisocial-engineering-contract.md](./antisocial-engineering-contract.md)) |
| Client compromise | Local-first keys, unlock friction over “stay signed in” convenience |
| Single transport failure | Pool + presets + redundancy / hybrid adapters |

Engineering claim: **fail closed and document**, never fake green connectivity.

---

## Values

1. **Encryption at the client** — plaintext is a client-side affair; transport carries ciphertext.  
2. **One owner per lifecycle** — protocol truth in kernel/contracts; no dual UI owners.  
3. **Separability** — replace the shell without rewriting crypto/storage/transport authority.  
4. **Integrability without capture** — adapters plug in; adapters do not redefine product identity.  
5. **Rigor over reach** — ship claims only when runtime + tests agree; avant-garde quality bar.  
6. **Anti-extraction** — no business model that mines messages or sells the graph.  
7. **Selective audience honesty** — write for journalists, privacy-required users, and people who refuse market-default tools — not for everyone.
8. **Auth without wallet theater** — passphrase unlock by default; no biometric MFA; private-key / recovery-phrase UX optional for advanced users only.

---

## Authentication design constraints

Aligned with [obscur-auth-kernel-charter-2026-06.md](./obscur-auth-kernel-charter-2026-06.md) and KEY-MOAT (Argon2id).

| Constraint | Rule |
|------------|------|
| **Identity root** | Cryptographic keypair under the hood (self-custody). Users need not think in “wallet” terms daily. |
| **Daily unlock** | **Passphrase** (Argon2id → local decrypt). Primary UX. |
| **Biometric MFA** | **Forbidden as product requirement.** Do not add Face ID / fingerprint as a second factor or mandatory gate. |
| **Private key / recovery phrase** | **Optional** advanced surfaces (import, export, recovery) — never required onboarding like a crypto wallet. Prefer passphrase-wrapped local identity. |
| **No SaaS MFA** | No SMS / email OTP / authenticator IdP as identity root. |
| **Attack resistance** | Argon2id + strength policy + unlock backoff + ASE — not MFA theater. |

**Product sentence:** Unlock like a secure local app (passphrase), not like a hardware wallet onboarding flow and not like Better Auth + MFA.

---

## Objectives (underground track)

| Objective | Done when |
|-----------|-----------|
| **Protocol clarity** | Specs / contracts name owners for DM, transport, vault, Tor policy |
| **Separable surfaces** | Rust backend authority + thin TS SDK/UI; documented language boundary |
| **Stress-capable paths** | Private mesh / hybrid / Tor packs with fail-closed gates; proof named (L1–L3) |
| **Operator deployability** | Small cell can run client + trusted endpoints without a corporation |
| **Artifact longevity** | Installer or build path + limitations + this charter — usable without maintainer as influencer |
| **Ecosystem fit** | Clear boundary with Aperio (discovery) and Vectis (structured settlement) |

**Non-objectives:** MRR, App Store scale, GitHub star contests, unpaid support for extractive forks.

---

## Personas

### P1 — High-requirement communicator

Journalist, researcher, organizer, or individual under active targeting. Needs E2EE, transport choice, and honest failure modes. Will tolerate unlock friction and operator setup.

### P2 — Regulated / censored environment user

Needs paths that do not depend on a single blocked SaaS. May use Tor or private mesh. Prefers fail-closed over silent clearnet fallback when Tor is required.

### P3 — Market-refuser / underground operator

Builds or runs tools outside platform extraction (same constellation as Vectis/Aperio maintainers). Wants auditable code, no landlord chat, forkability. May also run relays/coordination.

### P4 — Protocol / fork steward

Adopts or extends the specification and reference implementation for a closed cell. Needs modular boundaries more than marketing.

### P5 — Ordinary private groups (promotion face)

Friends, music clubs, hobby circles, small studios — people who want a **private room without a landlord**. Primary face of public demos and video. Same stack as high-requirement users; lower drama in the story.

### Not a persona

Casual “replace WhatsApp for my family of twenty” without threat model; VC evaluators; extractive freelancers harvesting OSS; enterprise SSO procurement; “crypto traders needing a chain-native chat.”

---

## Ecosystem position

Obscur is **one layer** in a resistance stack — not the whole economy:

```text
Aperio   →  find signals / opportunities (discovery)
Vectis   →  structure exchange on-log (escrow, evidence, credits ≠ money)
Obscur   →  speak privately under stress (E2EE + pluggable transport)
```

| System | Question |
|--------|----------|
| Aperio | What clues appeared that might be worth engaging? |
| Vectis | How do we commit, deliver, and close fairly on-log? |
| Obscur | How do we communicate without a platform landlord — under attack? |

Obscur does **not** settle deals or mint credits. Vectis does **not** own the chat threat model. Cross-links: Vectis foundation docs (sibling product) · Obscur [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md).

---

## Engineering bar (avant-garde, not amateur)

- Specs and owners before UI compensation  
- Subtraction when paths overlap  
- Named proof layers (L1 unit/contract · L2 integration · L3 soak under stated threat assumptions)  
- Known limitations published — no marketing past them  
- Modular: new transport = adapter + policy, not a second messaging stack  

Popular convenience features that weaken the threat posture (ambient always-on session, silent clearnet when Tor-required, central moderation theater) are **out of charter** unless explicitly reopened with a feasibility write-up.

---

## Access and promotion policy

- **Visibility:** Optional. Underground is valid.  
- **Promotion:** Operator playbooks and honest limits — not growth hacks.  
- **License / public vs private:** Maintainer decision against extractors; public OSS is not a moral requirement of this charter.  
- **Support:** No obligation to serve drive-by demand; rigor is owed to the protocol and its intended personas.

---

## Relation to current delivery (v1.9.x)

v1.9.x work (kernels, Conduit Mesh, transport presets, LES vault, Tor host integration) is **reference implementation toward this charter**. Feature bands that chase mass-market chat UX without threat benefit are **lower priority** than:

1. Transport integrity under failure and Tor policy  
2. Client/backend separation and Rust authority  
3. Documented operator paths for private trust  
4. Honest stress/limitation evidence  

Paused community public-relay roster perfection remains **out of charter** as a primary goal ([community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md)).

---

## Success criteria (charter-level)

This track succeeds if Obscur:

1. Remains a **credible encrypted communication protocol** with a separable reference client/backend  
2. Offers **integrable transports** without becoming any single network’s captive client  
3. **Fails closed** under documented hostile conditions rather than lying about connectivity  
4. Serves **select high-requirement users** (and maintainers like you) without needing mass awareness  
5. Can **outlive active promotion** as an underground artifact — forkable, inspectable, uncompromising  

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-17 | Initial charter — protocol identity, stress posture, personas, ecosystem role, avant-garde success bar |
| 2026-07-17 | Promotion messaging — no illegitimate labels; ASE as user protection; no mainstream comparison hook |
| 2026-07-17 | Crypto identity (not blockchain) · technical anarchy · benign promo scenarios · community ambition vs PAUSED reality |
| 2026-07-17 | Operator-sovereign scale — crowdfunded/high-capacity host under community control |
| 2026-07-17 | Auth constraints — no biometric MFA; key/recovery phrase UX optional |
