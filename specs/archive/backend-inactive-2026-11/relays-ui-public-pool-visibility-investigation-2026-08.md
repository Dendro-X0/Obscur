# Investigation — Relays UI hides public pool behind local-only cards (2026-08)

**Status:** Repair in progress  
**Date:** 2026-08-02  
**Handoff:** Prod-first multi-transport  
**Symptom:** Settings → Relays metrics show only `ws://localhost:…` (ACTIVE TRANSPORT); public packs feel invisible; toast may still mention `relay.damus.io`.

---

## Hypotheses

| ID | Hypothesis | Result |
|----|------------|--------|
| H1 | Stored relay list is loopback-only (RUST-2 / lab leftover); dashboard sources `enabledRelayUrls` from that list | **Confirmed** for local-only soak |
| H2 | `availableOnly` filter hides disconnected public cards | **Rejected** (toggle off in soak) |
| H3 | Dashboard never lists configured-but-undialed / disabled rows from full `relayList` | **Confirmed** — uses DM enabled + connections + metrics only |
| H4 | Engine may still dial/probe public URLs → damus toast without a metrics card | **Plausible** |

---

## Repair

1. Dashboard ordered URLs include **full configured list** (`relayList.state.relays`) plus engine-configured URLs.
2. Sticky honesty when configured list is **loopback-only**: CTA to apply Default Stable / Reset.
3. On load: if stored list is **loopback-only**, merge product-boot public rows (keep loopback entries) so pools appear without requiring a manual reset first.
