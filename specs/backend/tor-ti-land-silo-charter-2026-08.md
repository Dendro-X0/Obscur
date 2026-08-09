# Charter — Land / silo Tor TI–T5 WIP (no re-tag)

**Status:** **Landed** — commit `5d7cd8cd` 2026-08-09 · Tor Verified + T5-3 remain siloed · `v1.9.15` tag not moved  
**Date (UTC):** 2026-08-09  
**Parents:** [tor-integration-redesign-charter-2026-08.md](./tor-integration-redesign-charter-2026-08.md) · [tor-integration-external-test-readiness-2026-08.md](./tor-integration-external-test-readiness-2026-08.md) · [tor-t5-3-0-onion-ops-design-2026-08.md](./tor-t5-3-0-onion-ops-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  B — land Tor TI WIP · silo Verified + T5-3
PAUSED / CANCELLED:   AUTH-SESSION · Tor Verified (env) · T5-3 live onion
CANONICAL OWNERS:     apps/tor-gateway · tor.rs / spawn · dial policy · tor-lifecycle-ux
PROOF BEFORE DONE:    Commit on tree · L1 optional · no v1.9.15 re-tag · no Tor Verified claim
OUT OF SCOPE:         Re-tag 1.9.15 · invent *.onion · UI SOCKS · commit binaries/appdata
```

## Why

Post-`v1.9.15` Tor TI/T5 work is a large **dirty tree**. Packaged soaks (Vault, Community) already ran on that tree. Leaving it uncommitted risks loss and confuses “tag claim” vs “working tree.”

**Land** = commit the lifecycle redesign + specs into git history.  
**Silo** = do **not** claim Tor Verified; do **not** ship product onion defaults; do **not** move `v1.9.15` tag onto this commit.

## Claim after land

| May say | Must not say |
|---------|----------------|
| Tor TI-1…TI-4 **Implemented (L1)** on mainline | Tor **Verified** |
| Gateway co-start / Ready-gate dial policy **landed** | Production Tor-ready / onion live |
| IsolateSOCKSAuth exit-1 fix **landed** | This host Tor bootstrap Pass |
| T5-3.0 ops design **Ready** | Product ships a real `*.onion` |

`v1.9.15` @ prior tag remains the **DM/media** release claim. Tor land is **post-tag WIP**, not a silent retag.

## Include in commit(s)

| Area | Paths (representative) |
|------|------------------------|
| Gateway | `apps/tor-gateway/**` · workspace `Cargo.toml` · desktop Cargo deps |
| Desktop Tor | `tor.rs` · `tor_gateway_spawn.rs` · `tor_gateway_client.rs` · related commands/models |
| PWA Tor UX / policy | `relay-tor-dial-policy*` · `relay-tor-viable*` · `tor-lifecycle-ux*` · Relays/Security panels · i18n |
| Mesh / transport | conduit-mesh tor map · transport preset / scope if Tor-touched |
| Dev stack | `scripts/dev-workspace-stack.mjs` gateway co-start |
| Specs | `specs/backend/tor-*-2026-08.md` · this charter |
| Continuity | handoff / CURRENT / truth-map Tor rows as needed |

## Exclude from commit

| Path | Why |
|------|-----|
| `release-assets/**/*.exe` | Binary installer — not source |
| `appdata/` | Local runtime / tor settings |
| `.codectx/` · `.codegraph/` | Tooling cache |
| `**/target/**` | Build artifacts |
| Secrets / `.env.signing*` | Never |

## Silo after land

| Band | State |
|------|--------|
| Tor Verified | **Siloed** — needs Tor-capable network + [tor-t5-l3-soak-checklist](./tor-t5-l3-soak-checklist-2026-08.md) |
| T5-3 onion ops | Design Ready · **no** product hostname until T5-3.1 |
| AUTH-SESSION | CANCELLED / PAUSED unchanged |
| Community | CU-P1 Verified — unrelated; do not mix free `groups/**` |

## Commit policy

- Prefer **one** logical commit for Tor TI land (or split: `feat(tor): …` then `docs(tor): …` if size demands).  
- Message must state: **not Tor Verified · does not move v1.9.15**.  
- Optional follow-up: community/Vault continuity docs if not already in tree.

## Next after land

| Option | When |
|--------|------|
| **C** | Tor Verified soak on a Tor-capable net |
| **D** | CU-EXIT / version-band planning (e.g. 1.9.16 notes for Tor land) |
| **E** | Stop |

## Agent rules

| Allowed | Forbidden |
|---------|-----------|
| Commit listed include set | `git tag -f v1.9.15` / move tag |
| Handoff: Tor TI landed · Verified siloed | Claim Tor Verified from this host |
| | Commit exe / appdata / secrets |
| | Invent onion defaults |
