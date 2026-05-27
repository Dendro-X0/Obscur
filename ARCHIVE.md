# Obscur monorepo — experiment trunk

**Status:** Active experiment (2026-05) — loadability reset, not a product commitment  
**Charter:** [docs/program/obscur-experiment-reset-2026-05.md](docs/program/obscur-experiment-reset-2026-05.md)  
**Handoff:** [docs/handoffs/current-session.md](docs/handoffs/current-session.md)  
**Greenfield (reference only):** [docs/greenfield/README.md](docs/greenfield/README.md) — separate repo; specs copied here for extraction reference

---

## What this repository is

This tree is the **Obscur** (`dweb-messenger`) monorepo: PWA, Tauri desktop, coordination worker, Nostr adapters, and community features developed through v1.5.x–v1.9.x program bands.

**Active work:** disruptive loadability experiment — subtract parallel startup owners, defer heavy hydrate/sync, stub relay transport at unlock. See experiment charter for scope and non-goals.

Historical structural limits (public-relay membership, competing truth sources) remain documented in:

- [docs/handoffs/current-session.md](docs/handoffs/current-session.md)
- [docs/greenfield/](docs/greenfield/) — greenfield charter (reference, not active client)

---

## Prior archive note (superseded 2026-05-22)

An earlier snapshot marked this trunk **discontinued** in favor of Greenfield-only development. That decision is **superseded**: maintainer chose to continue Obscur as an experiment rather than archive permanently.

| Issue | Prior verdict | Experiment stance |
|-------|---------------|-------------------|
| Public Nostr relays as membership authority | Infeasible for workspace roster truth | Still true; coordination Path B remains reference |
| Patch-debug loops on startup/relay | Stop condition reached | Subtraction + experiment shell, not tuning |
| Scope vs solo maintainer | Program bands exceeded sustainable execution | &lt;50% completion OK; loadable shell is the gate |

---

## What to use from here

| Use | Location |
|-----|----------|
| **New product specs** | Copy [docs/greenfield/](docs/greenfield/) to the new repository |
| **UI components** | [packages/ui-kit/](packages/ui-kit/) — extract per [docs/greenfield/08-extraction-manifest.md](docs/greenfield/08-extraction-manifest.md) |
| **Crypto primitives** | [packages/dweb-crypto/](packages/dweb-crypto/) — audit then copy |
| **Coordination patterns** | [apps/coordination/](apps/coordination/) — reference only for signed directory |
| **Local dev (historical)** | [docs/assets/demo/private-trust-local-setup.md](docs/assets/demo/private-trust-local-setup.md) |

**Do not** treat Obscur runtime paths (`apps/pwa/features/groups`, sealed community, relay-as-roster) as the foundation for the successor.

---

## Successor repository (use this for all new work)

| | |
|--|--|
| **GitHub** | https://github.com/Dendro-X0/greenfield |
| **Local** | `E:\Web Projects\greenfield` |
| **Handoff** | `docs/handoffs/current-session.md` in greenfield |
| **Extraction record** | `EXTRACTION.md` · `EXTRACTION-LOG.md` |

Do **not** continue feature work in this Obscur tree. Agents and maintainers should open the greenfield workspace only.

---

## Optional maintenance on this archive

- Security fixes for published Obscur releases (if any)
- No new v1.9.x feature bands unless explicitly reviving Obscur

---

## Stars and visibility

Forks and stars may point here historically. New work should link to the successor repo when it exists. This README and [ARCHIVE.md](ARCHIVE.md) state that **Obscur is not the active line of development**.
