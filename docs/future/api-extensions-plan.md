# API extensions plan (inspiration → product boundary)

**Status:** Living plan — **does not gate** business S2 (hitch / self T1) or v1.9.x daily work  
**Updated:** 2026-10-10  
**Inspiration corpus:** [public-apis/public-apis](https://github.com/public-apis/public-apis) categories (Security, Auth, …) as *shapes*, not vendor wraps  
**Portfolio card:** `new-business/research/164-public-apis-portfolio-inspiration.md`  
**Canon:** [obscur-ecosystem-charter.md](../program/obscur-ecosystem-charter.md) · [GOALS-AND-GUARDS.md](../business/GOALS-AND-GUARDS.md)

---

## Intent

Document which **functional API / adapter extensions** Obscur may grow later — and which stay permanently out — so agents do not invent IdP, drip-email, or “crypto glue” features from free-API lists.

---

## Keep (optional · operator-owned)

| Extension | Shape | Notes |
|-----------|-------|-------|
| Pluggable transports | Adapt | Private WS/HTTP mesh, hybrid, Tor policy — already charter |
| Optional Nostr adapter | Adapt | Transmission only; not product definition |
| Operator host / DNS / VPS as runtime | Adapt | Human + CLI; not Obscur-as-landlord API |

No commitment to ship new transports on a date. Prefer hardening existing ports over adding public REST surfaces.

---

## Park (docs / narrative only until EG clear)

| Extension | Shape | Notes |
|-----------|-------|-------|
| Security / threat-intel *literacy* | Verify (story) | Gift/docs: what public APIs leak vs cell sovereignty — not a product feature |
| External “reputation” checkboxes | Verify | Do not become a cloud trust oracle |

---

## Kill (permanent for this product)

| Extension | Why |
|-----------|-----|
| OAuth / “Login with Google” landlord IdP | Anti-sovereignty |
| Transactional or cold email / SMS APIs as GTM | Constraint B / growth-hack spine |
| Admin API that overrides user keys or private content | Charter hard lock |
| Blockchain RPC / token / price-oracle glue | Wrong product (Vectis lane if anywhere) |
| CRM / lead-enrichment APIs | Not Obscur’s job |

---

## Sequencing rule

```text
S2 hitch or self T1 first.
API/transport work only when it serves an admitted cell or known limitation —
never “because public-apis has a Security section.”
```
