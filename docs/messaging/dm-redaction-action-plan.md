# DM sender redaction — actionable plan (next 2–3 weeks)

**Canonical gate & user promise:** [`docs/releases/v1.5.0-dm-sender-redaction-scope-and-gate.md`](../releases/v1.5.0-dm-sender-redaction-scope-and-gate.md)  
**Explicit non-goals for v1.5.0:** community extension bundles, anti-phishing / anti-fraud / anti-bot **product modules** (track under v1.5.x+).

This plan splits work into **(A) shipping the redaction pipeline to the release gate** and **(B) one new user-visible feature** that is shippable quickly and aligned with trust/safety **without** expanding v1.5.0 scope into full anti-abuse.

---

## A. Close v1.5.0 redaction gate (engineering)

Work in order; stop and document blockers instead of parallelizing fragile paths.

| Step | Action | Done when |
|------|--------|-----------|
| A1 | Run automated bundle: `pnpm verify:dm-redaction` at repo root | All tests green |
| A2 | Walk **§4 Release gate** in the scope doc line-by-line; for each item, link to test name or manual smoke note | Checklist checked in handoff or GitHub issue |
| A3 | Two-profile smoke: A sends DM → B sees → A redacts → B’s Obscur no longer shows message (same relay set) | Logged result in `docs/handoffs/current-session.md` |
| A4 | Dedup/echo: repeat A3 with A seeing self-echo from relay; redaction still applies | No stuck `dedup`/`Not a delete command` in logs |
| A5 | `pnpm -C apps/pwa exec tsc --noEmit` | 0 errors |
| A6 | Update CHANGELOG / release notes **only when tagging** (not in exploratory commits) | Per repo policy |

**If A3/A4 fail:** triage in this order: relay URL set (hybrid targeting), receive classifier (`decodeDmDeleteCommandV1` + trim), coordinator ingest (`processIncomingDmDeleteCommand`), local projection/tombstone.

---

## B. Composer outbound link hosts (read-only) — **implemented**

**Code:** `apps/pwa/app/features/messaging/utils/extract-http-url-hosts.ts` (+ unit tests), wired in `components/composer.tsx` (line above the main input when the draft contains `http://` / `https://` URLs).

**i18n:** `messaging.composer.linkHosts` (`en`, `zh`, `es`).

**Behavior:** Deduped host list, no network calls, does not block send.

---

## C. Roadmap placement

| Horizon | Content |
|---------|---------|
| **v1.5.0** | Redaction gate (A) + protocol-limits note in Settings + **Composer link hosts (B)** (shipped) |
| **v1.5.x** | Deeper anti-phishing (heuristics, safe browsing patterns), anti-fraud signals, anti-bot — **separate specs** |
| **Parallel** | Community / extension workstreams — **do not block** redaction gate unless shared owner conflict (see AGENTS.md) |

---

## D. Maintainer commands (no UI)

```bash
# Focused automated verification for DM redaction pipeline
pnpm verify:dm-redaction

# Full docs link integrity
pnpm docs:check
```

---

## E. Decision log (fill when closing)

- **v1.5.0 tag includes B?** yes / no  
- **Residual risks:** …
