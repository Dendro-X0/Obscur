# Feasibility — What still must be confirmed (Cut 0 gate)

**ID:** F-confirm  
**Status:** draft — **tier A recorded 2026-11-09**  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F9 NARROW · F-shell · F8 · F5 · F4 · F-alt · F-gaps · 15b · F-msg  
**Claim language:** **checklist** ≠ Cut 0 designed · ≠ Soft L3 Fixed · ≠ T3 shipped

## 1. Scope

- **In:** After F9 **NARROW** + F-shell, what the maintainer must still **confirm** before Cut 0 design can freeze (and what can wait).
- **Out:** Implementing Cut 0; resolving Soft L3 Pass; picking every library forever.

## 2. Basics — already decided (do not re-open for Cut 0)

| Topic | Recorded |
|-------|----------|
| Platform shape | Aggregator · one profile · carriers = adapters (F0.5) |
| Synthesis | **NARROW** — staged workspace · private-trust S1 primary (F9) |
| Auth face | Password-wrap + optional passkey/keystore; reject OAuth root (15b) |
| CRM | Sticky local graph; reject history-as-contacts (F1) |
| DB engine | SQLite + vault envelopes (F8) |
| Shell near-term | Keep Next through Cut 0; Tauri WebViews; no Electron (F-shell) |
| Still paused | Soft L3 Fixed · Tor Verified · Matrix promote · UI migrate-as-salvage |

## 3. Capabilities map — confirmation tiers

### A. Must confirm before Cut 0 **design freeze** — **RECORDED**

| # | Confirm | **Decision** | Implication |
|---|---------|--------------|-------------|
| **A1** | Cut 0 message tables | **Messaging skim first** | Do not freeze schema until [`24-messaging-plane-skim.md`](./24-messaging-plane-skim.md) lands |
| **A2** | MVP private home | **Thin H-dc** | Cut 0 transport default = Obscur-defined thin DC API (not H-relay-only) |
| **A3** | S1 reference compose | **Later** | Ports/contracts first; operator compose doc after Cut 0 design |
| **A4** | Launch crypto honesty | **T3** | Private-trust launch face requires Obscur DR (F5 **E2**); T2-only not enough for launch badge |
| **A5** | At-rest DB encrypt | **Same band as spine** | Cut 0 includes DB at-rest pick + impl path (SQLCipher **or** file AEAD — choose in Cut 0 design, was C1) |
| **A6** | Linked-identity secrets | **OS keychain** | Tokens/secrets → keychain refs; not vault-only |
| **A7** | Minimum lovable milestone | **Yes** | Lab OK = vault + sandbox + CRM **without** public carrier (H-dc private-trust only) |
| **A8** | Payments / zaps | **Non-goal** | Explicit rewrite-band non-goal |

### B. Confirm before Cut 0 **impl starts** (design may draft with TBD)

| # | Confirm | Notes |
|---|---------|-------|
| **B1** | Profile oracle owner module name / IPC surface | One id owner — exact crate/command list |
| **B2** | Session orchestrator boundary (what leaves React) | 15b Planes 1–2 |
| **B3** | Single vs split SQLite files per profile | **Recorded in Cut 0 design:** single file/profile |
| **B4** | Soft L3 stays paused through Cut 0 ship | **Assumed yes** (schema ≠ contact Pass) |
| **B5** | Proof plan L1–L4 for Cut 0 | **Named in Cut 0 design §11** |
| **B6** | At-rest mechanism pick | **PDK whole-file AEAD (`.obscur-enc`)** — SQLCipher deferred |

### C. Defer (updated after A)

| # | Topic | Defer to |
|---|-------|----------|
| **C1** | ~~SQLCipher vs file AEAD~~ | **Moved to B6** (A5) |
| **C2** | Next → Vite + TanStack Router | Cut UI |
| **C3** | Browser PWA pipeline | Cut UI |
| **C4** | Matrix leave-lab criteria | After S1 messaging soak |
| **C5** | MLS-in-kernel (T4 groups) | After T3 1:1 (A4) |
| **C6** | Tor Verified / onion media | Explicit later band |
| **C7** | Android/iOS primary | Secondary until desktop Cut 0 proven |
| **C8** | Calls / notifications / moderation deep designs | Product-module explorations |
| **C9** | Live multi-device Continuity (CRDT) | After M1/M2/M4 sealed backup |
| **C10** | S6 pure P2P | Non-goal near-term |
| **C11** | S1 reference compose write-up | After Cut 0 design (A3) |

### D. Still owed before design freeze

| Note | Status |
|------|--------|
| Messaging plane skim | **Done** → `24-messaging-plane-skim.md` |
| Thin H-dc API sketch | **In Cut 0 design §7** (v0.1 ciphertext + poll) |
| Cut 0 design | **Opened** → `specs/backend/cut0-account-spine-design-2026-11-09.md` (await ACK) |
| Threat-model one-pager | Optional but useful |

## 4. Fit to planes — post-A posture

| Plane | Posture |
|-------|---------|
| Auth | 15b + keychain secrets (A6) |
| Profile | Isolation + oracle (B1) |
| Storage | SQLite + vault + **at-rest in Cut 0** (A5) |
| Relationship | Sticky graph; Soft L3 paused (B4) |
| Message | Skim then schema (A1); **T3** for private-trust 1:1 (A4) |
| Transport | **Thin H-dc** default (A2); compose later (A3); no public carrier required for lab (A7) |

## 5. Libraries / stacks

Unchanged from F-shell. At-rest pick (B6) is the only new library decision forced into Cut 0.

## 6. Feasibility verdict

**Tier A closed. Messaging skim done. Cut 0 design opened** (`cut0-account-spine-design-2026-11-09.md`) with B6 = PDK file AEAD.

**Next gate:** maintainer **ACK slice 0.0**, then impl 0.1. Soft L3 remains paused.

## 7. Risks / traps

- Treating A4 as “label T3” without E2 DR work.  
- Freezing message tables before skim finishes.  
- Building full S1 compose appliance now despite A3=later.  
- Re-opening payments under “just zaps.”

## 8. Open questions

Remaining: tier **B** (esp. B3, B6) + messaging skim open Qs. Soft L3 pause (B4) — confirm explicitly if not already assumed.

## 9. References

- Maintainer answers 2026-11-09 (chat)  
- `24-messaging-plane-skim.md` · `99-synthesis-decision.md` · `05-e2ee-models.md` · `04-private-relay-server.md` · `08-universal-auth-profile-db.md`  
