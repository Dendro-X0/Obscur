# Feasibility — Tor as underlay (not product identity)

**ID:** F6  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-PSE · F-netconfig · F4 · F2 · F3 · F5 · F-hub  
**As-built:** `TransportId` `clearnet | tor | quiet` · `applyActiveTransport` / Tor gateway IPC (`start_tor`/`stop_tor`) · `GatewayTorStatus` (ready only if `bootstrap_ready`) · `tor_onion_mesh` preset (template)  
**Claim language:** **explored underlay** ≠ Tor Verified · ≠ anonymity Pass · ≠ Tor = E2EE

## 1. Scope

- **In:** Tor as an **optional network underlay** for dialing homes (relays, HS, DC, onion mesh): what it gives, what it does not, UX/status honesty, fit to private-trust.
- **Out:** Claiming Tor Verified; shipping a Tor Browser replacement; treating onion dial as content encryption; Soft L3.

## 2. Basics

**Tor** routes TCP through volunteer relays so observers of the local network see Tor traffic, not the destination (for clearnet exits) or stay inside Tor for **onion services** (`.onion`).

| Tor is | Tor is not |
|--------|------------|
| A **path** (underlay) under F-netconfig | The Obscur product name or security badge |
| Helpful vs ISP/censor seeing *which* relay/HS you dial | A replacement for F-PSE message tiers |
| Stronger when talking to **onion homes** (no exit) | Immunity to endpoint compromise or traffic analysis |
| Orthogonal to Nostr/Matrix/private_dc apps | Automatic “unbreachable” messaging |

**SOCKS limits (Tor specs):** Tor SOCKS is TCP-oriented; **UDP ASSOCIATE / BIND unsupported**. Real-time UDP media (some WebRTC paths) will not “just work” through SOCKS without separate design (TURN over Tor, onion-only TCP media, or clearnet media with honesty).

**Onion services** (Tor Project guidance): censorship resistance, self-certifying addresses, end-to-end encryption *on the Tor path*, no need to open inbound ports on the host — still **application metadata** remains if the service learns who you are (login, pubkey, patterns).

### Obscur placement

```text
Protocol app (Nostr | Matrix | Private mesh)
        │
        ▼
 Named home (URL / .onion)          ← F4 / F-groups pin
        │
        ▼
 Underlay: clearnet | tor | quiet   ← THIS NOTE
        │
        ▼
 Tor gateway (SOCKS) / direct dial
```

As-built: selecting `tor` turns on privacy-settings Tor proxy and asks the **desktop Tor gateway** to start; UI “ready” requires gateway `ready` **and** `bootstrap_ready`.

## 3. Capabilities map

| Need for Obscur | Tor provide? | Notes |
|-----------------|--------------|-------|
| Hide destination from local network | **Partial / yes** | Best with onion home; clearnet-via-exit has exit-node caveats |
| Reach censored public relays/HS | **Partial** | Depends on Tor reachability in region |
| Private-trust family VPS | **Optional harden** | Prefer onion twin of H-relay/H-dc (F4) |
| Content confidentiality | **No** | Still need T2–T4 (F5); Tor path crypto ≠ message E2EE |
| CRM / relationship sync | **No** | Unrelated |
| Voice/video | **Hard** | UDP/WebRTC vs SOCKS — separate design or degraded mode |
| “Tor Verified” marketing | **No until soak** | Forbidden claim language until named proof |
| Replace private DC | **No** | Underlay only |

## 4. Fit to planes

| Plane | Fit | Notes |
|-------|-----|-------|
| Auth | None as root | Tor does not unlock workspace |
| Profile | Pref scoped | Tor on/off + proxy URL per profile |
| Storage | None | |
| Relationship | None | |
| Message | Orthogonal | Same ciphertext; different dial path |
| Transport | **Owner of underlay** | `clearnet` / `tor` / `quiet`; Quiet ≠ Tor (as-built: Quiet keeps dial caps, Tor off) |

## 5. Libraries / stacks

| Candidate | Role | Notes |
|-----------|------|-------|
| As-built Tor gateway + Tauri IPC | Desktop underlay control | Does not spawn `tor.exe` in-adapter — gateway process |
| System Tor / Tor Expert Bundle | SOCKS provider | Ops dependency; bootstrap honesty required |
| `tor_onion_mesh` preset | Home template | `requiresTor` + URL template — user must replace `.onion` |
| Arti (Rust Tor) | Future embed | Aligns F-stack long-term; not required for F9 |

## 6. Feasibility verdict

**`fit-with-adapter`** — Tor is a **feasible optional underlay** for Obscur: enable per workspace, dial onion or clearnet-via-Tor homes, show **bootstrap/degraded** status honestly. It strengthens **censorship resistance and network-path privacy**; it does **not** satisfy E2EE tiers or CRM laws.

**`lab-only` / gated:** Any **Tor Verified** product claim; onion media/calls; “Tor mode = secure chat.”  
**`reject-for-core`:** Tor as product identity; green connected badge ⇒ verified anonymity; forcing Tor for all private-trust users on day one.

### Recommended product rules

1. **Underlay panel (Advanced)** — Clearnet / Tor / Quiet; never buried only inside Nostr settings.  
2. **Status copy** — `Starting` until `bootstrap_ready`; never “Verified.”  
3. **Homes** — Mark which homes are onion-only / Tor-recommended (F-netconfig).  
4. **Crypto badge unchanged** when Tor toggles (F-PSE).  
5. **Calls** — If Tor on and media needs UDP, fail closed or explicit “media may use clearnet” consent.  
6. **Default** — Private-trust profile may *offer* Tor; do not block unlock on Tor bootstrap.

## 7. Risks / traps

- DNS leaks if clients resolve clearnet hosts before SOCKS (`socks5h` / onion literal discipline).  
- Dual-stack leaks (some sockets Tor, some clearnet) — especially media and updates.  
- Equating onion TLS path with message FS/PCS.  
- Mobile background Tor battery/reliability without a dedicated design.  
- Soft L3 soak on Tor path without bootstrap-ready gating (as-built already learned this).

## 8. Open questions

1. Ship desktop Tor gateway as **required** companion for Tor mode, or allow user-supplied system SOCKS only?  
2. Reference F4 compose: publish **onion twin** instructions for Obscur Home appliance?  
3. Quiet vs Tor: keep both forever, or rename Quiet to “capped clearnet”?  
4. Matrix over Tor: SOCKS for all CS traffic — promote prerequisite or optional?  
5. When (if ever) embed Arti instead of external gateway?

## 9. References

- Tor SOCKS extensions: https://spec.torproject.org/socks-extensions  
- Onion service properties: https://onionservices.torproject.org/technology/properties/  
- Tor Project — messaging + onion services how-to (external)  
- `apps/pwa/app/features/protocol-adaptation/apply-active-transport.ts`  
- `apps/desktop/src-tauri/src/commands/tor_gateway_client.rs`  
- `apps/pwa/app/features/transport-kernel/transport-preset-catalog.ts` (`tor_onion_mesh`)  
- `docs/exploration/feasibility/11-performance-security-encryption-standards.md`  
- `docs/exploration/feasibility/19-network-protocol-configuration-ux.md`  
