# Production-truth release recovery (2026-08)

**Status:** Active north star · replaces “Dev Lab green ⇒ ship”  
**Date (UTC):** 2026-08-02  
**Handoff:** [current-session.md](../handoffs/current-session.md)  
**Charter pair:** [v1.9.15-scope.md](./v1.9.15-scope.md) · CodaCtrl findings [codactrl-improvement-findings-2026-07.md](./codactrl-improvement-findings-2026-07.md)

## Why this exists

Dev Lab / localhost-only soaks **masked** transport and delivery failures. Packaged / production-parity builds (`EXPERIMENT_ONLINE=1`, Dev Lab unset) then looked “completely broken” while UI chrome still rendered.

**Mandate:** Prove features on the **same path users ship** — public (or operator) relays, dual profiles, no synthetic Dev Lab send as release evidence.

**Speed rule:** Fix the **shortest user-visible vertical slices** in order. Do **not** spray-patch every subsystem in parallel (creates more false greens).

---

## Dual track

| Track | Goal | Proof |
|-------|------|-------|
| **A — Obscur release** | Demo-safe messaging on production-parity desktop | Soft L3 Row A+B · publish ACK · receive ≤45s · no Docker-required claim |
| **B — CodaCtrl dogfood** | Studio covers edge cases that Dev Lab hid | Live CDP dual-window · digest · chain · Fail-class pin · false-green refuse |

Track B never substitutes for Track A. Track A never claims Pass from T0/T1 / map hops / Dev Lab alone.

---

## Release slice order (do one at a time)

| # | Slice | User action | Pass when | Pause / skip |
|---|-------|-------------|-----------|--------------|
| **R0** | Boot honesty | Cold launch production-parity shell | Unlock → main shell; Relays show real public/local cards | AUTH-SESSION cancelled · **Pass** (operator desktop online) |
| **R1** | **DELIVERY-1** | A sends DM to B on **public** path | Publish ACK + B receives marker ≤45s | **Soft L3 Pass** (`l3.pass`+`fAck`, marker `S-POOL-L3-msbmmy68`, 2026-08-02) · not public Nostr SLA |
| **R2** | Relays dial honesty | Both profiles open primal/nos | POOL MEMBER / open on both; no local-only trap | **Pass** (`r2-relays-dial-honesty-2026-08-02.json`) |
| **R3** | Contact / trust | Accept peer · compose without stranger FK | Accepted contact send works | **Pass** (`r3-contact-trust-2026-08-02.json` · Soft L3 send corroboration) |
| **R4** | Persist | Send → quit → relaunch | Thread still shows marker | **Pass** (WebView reload smoke · Soft L3 marker `S-POOL-L3-msbmmy68` · not O-2 cold process; O-2 repair still PAUSED) |
| **R5** | Vault / LES | Secure upload / chat save (if in demos) | Existing LES L3 gates | — |
| **—** | Community / COM-RUN | — | **Out of release** until un-pause | **PAUSED** |
| **—** | AUTH-SESSION F5 | — | — | **CANCELLED** |

**Exit for “messaging works in prod”:** R0–R3 Pass on production-parity desktop. Tag **v1.9.15** only when [v1.9.15-scope](./v1.9.15-scope.md) D1 Soft L3 Pass + maintainer sign-off.

---

## Forbidden (same as handoff)

- Dev Lab synthetic send as release proof  
- Soft L3 Pass on Docker-only as product success  
- Claiming public Nostr SLA / worldwide delivery  
- Patching COM-RUN / community / AUTH-SESSION  
- “UI looks fine” as transport Pass  
- Fourth patch on same Fail class without updated investigation

---

## CodaCtrl coverage goals (from this recovery)

Use Obscur R1–R3 as the proving ground:

1. **No-CDP honesty** — dogfood fails closed with launch recipe (`:9230`/`:9231`).  
2. **Fail-class taxonomy** — F-ACK / F-TARGET / F-RECV / F-DIAL / F-ENV as first-class Studio labels.  
3. **Hypothesis nodes without session** — chain append when CDP down.  
4. **Handoff-bound pathway** — next tool follows `current-session.md`, not stale R-AUTH salvage.  
5. **Soft L3 scenario pack** — dual-window public DM marker assert.  
6. **Signal extract** — `lastSuccessfulPublishAtUnixMs` null + `[dm-send] confirmed` → `dm-relay-publish-ack-missing`.

Detail backlog: [codactrl-improvement-findings-2026-07.md](./codactrl-improvement-findings-2026-07.md) § Round 2026-08-02.

---

## Immediate next action

1. **R0–R3 Pass** on production-parity (agent Soft L3 + R2 + R3 reports 2026-08-02). Demo-exit messaging bar met per recovery charter.  
2. **Not** public Nostr SLA · **not** v1.9.15 tag until maintainer Soft L3 sign-off per [v1.9.15-scope](./v1.9.15-scope.md).  
3. Optional residuals: session-snapshot honesty · Soft L3 L2 stamp re-read · fresh-compose R4 harden.  
4. **R4 persist smoke Pass** (2026-08-02) — WebView reload · Soft L3 marker corroboration · not O-2 cold process.  
5. **CodaCtrl Track B dogfood recorded** (2026-08-02b) — dual CDP Works; `:3340` preflight / handoff pathway / sessionless chain still Fail — see findings § Round 2026-08-02b.

**Do not** expand to community until un-pause; Soft L3 re-proof after transport regressions.
