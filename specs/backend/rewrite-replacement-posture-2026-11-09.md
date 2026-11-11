# Decision — Replacement-style rewrite posture (backend-first)

**Date:** 2026-11-09  
**Status:** maintainer direction recorded · stress-test of F9 NARROW vs Cut 0 as-built  
**Parents:** SUPERSEDE rewrite band · F9 NARROW · Cut 0 spine · F-sync

```text
HANDOFF ATOMIC STEP: Record replacement posture; name what Cut 0 may keep vs what must die
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     platform rewrite band (kernel planes)
PROOF:               this note + next cut design (kill list + cutover) — not Soft L3
```

## 1. Maintainer vision (binding intent)

> Comprehensive **replacement-style** rewrite — especially backend. Prior foundations that are **fundamentally unviable** must not be preserved out of sunk-cost loyalty. If a new design is sound and hits objectives, **any** module may be rewritten or deleted — including large surfaces — because keeping flawed owners raises later refactor cost.

This does **not** reopen Soft L3 / Tor Verified / Matrix promote. It **does** clarify that NARROW is a **product/carrier cut**, not a **code-preservation cut**.

## 2. Critical evaluation — is the current design approach sound?

### What is sound (keep as rewrite *law*, not as legacy code)

| Law | Why viable |
|-----|------------|
| Aggregator: protocols = adapters; one account plane | Matches promotion goal; rejects “Nostr is the app” |
| Sticky CRM local graph; never invent TRUSTED from history | Soft L3 failure mode was architectural, not “missing a patch” |
| Private-trust S1 primary; H-dc thin ciphertext transport | Launch face honesty; no public-carrier CRM |
| T3 = own DR path; NIP-17 ≠ T3 | Stops false security labels |
| Single profile oracle · session/PDK out of React · at-rest envelope | Cut 0 L1 evidence supports these |
| Continuity ≠ daily unlock (F-sync) | Prevents “password restores wiped PC” lie |

### What is **not** sound if treated as “preserve and wrap”

Cut 0 **spine** is a correct first wedge. The **risk** is shipping glue that leaves **old lifecycle owners** as the real product path:

| Unviable / dual-owner residue | Why keeping it costs more later |
|-------------------------------|----------------------------------|
| CRM / trust in `localStorage` + projections while `relationship_edge` exists | Two truths; Soft L3 class bugs return |
| Message durability in IndexedDB/`chat-state` **and** SQLite | Dual owners; sync/hydrate races |
| Default send still Nostr-primary while `privateTrust` is lab-only | Product face contradicts NARROW |
| Feature modules that open PDK / invent `profileId` | Undoes 0.2–0.3 fences |
| Treating strangler adapters as permanent architecture | Encodes unviable foundations under new names |

**Verdict:** F9 **NARROW** remains the right **product** cut (private-trust first, not peer hub day one). The rewrite **method** must be **replacement of authority** (one owner per lifecycle), not strangler-forever. Cut 0 L1 modules (schema, PDK lock, H-dc v0.1, T3 seal, `privateTrust` engine) are **candidates to keep**; surrounding as-built product paths are **not sacred**.

### Full greenfield vs in-repo replacement

| Option | Fit to vision |
|--------|----------------|
| Mass-delete repo day one | Rejected by SUPERSEDE keep-rules (usable Tauri shell, no silent beta wipe, no mass-delete docs/skills as first move) |
| **In-repo replacement cuts** — new kernel owners; delete/quarantine old owners on a named schedule | **Preferred** — matches vision + keep-until-design |
| Preserve old modules “until Soft L3 Pass” | **Reject** — Soft L3 is paused proof debt; must not gate architecture |

## 3. Objectives check (rewrite succeeds only if)

1. One unlock · one profile · one encrypted workspace DB · sticky CRM · vault/sandbox · thin H-dc · T3 1:1 — **without** public Nostr/Matrix as peers (A7).  
2. Carriers never own CRM or message PKs.  
3. No parallel durable writers for the same lifecycle.  
4. UI is a thin client of kernel ports — not a second backend.  
5. Continuity (F-sync) stays Plane 3 — not smuggled into password unlock.

Line count is irrelevant: if a module blocks (1)–(5), it is in scope to replace.

## 4. Next cut (named — design owed before mass delete)

**Cut 1 — Replacement authority (backend-first)** — design draft:

→ [`cut1-replacement-authority-design-2026-11-09.md`](./cut1-replacement-authority-design-2026-11-09.md)  
(Kill list K-CRM · K-MSG-DUR · K-OUTBOX-LS · K-SEND-FACE · K-CHATSTATE-AUTH · K-PROTO-PLAIN · slices 1.0–1.6)

**Cut 2** (S1 compose / private-trust product face) — **CLOSED**: [`cut2-private-trust-product-face-design-2026-11-09.md`](./cut2-private-trust-product-face-design-2026-11-09.md).  
**Cut 3** (Cut UI Vite thin shell) — **CLOSED**: [`cut3-ui-vite-thin-shell-design-2026-11-09.md`](./cut3-ui-vite-thin-shell-design-2026-11-09.md).  
**Cut 4** (Vite native DeviceUnlock + H-dc/T3 ports) — **CLOSED**: [`cut4-vite-native-port-wire-design-2026-11-09.md`](./cut4-vite-native-port-wire-design-2026-11-09.md).  
**Cut 5** (Vite production cutover) — **CLOSED**: [`cut5-vite-production-cutover-design-2026-11-10.md`](./cut5-vite-production-cutover-design-2026-11-10.md).  
**Cut 6** (release / CI Vite align) — **CLOSED**: [`cut6-release-ci-vite-align-design-2026-11-10.md`](./cut6-release-ci-vite-align-design-2026-11-10.md).  
**Cut 7** (Continuity M1 / F-sync C0) — **CLOSED**: [`cut7-continuity-m1-sealed-file-design-2026-11-10.md`](./cut7-continuity-m1-sealed-file-design-2026-11-10.md) · **≠ Continuity Pass**.

## 5. Forbidden misreads

- “Replacement rewrite” → delete safety law / quarantine / profile isolation  
- “NARROW” → keep Nostr as product forever  
- “Cut 0 done” → product already private-trust primary (spine ≠ cutover)  
- “Hundreds of thousands of lines” → unscoped mega-PR without kill list + proof plan  

## 6. References

- `docs/handoffs/current-session.md` § Maintainer instruction (SUPERSEDE)  
- `docs/exploration/feasibility/99-synthesis-decision.md`  
- `specs/backend/cut0-account-spine-design-2026-11-09.md`  
- `specs/backend/cut0-private-trust-glue-design-2026-11-09.md`  
- `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
