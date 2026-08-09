# Design — Tor integration + local-first runtime (post v1.9.15 restore)

**Status:** Phase 2 L1 · Phase 3 early enable **L3 Fail** · fail-closed slice **Implemented** (pending L3) · 2026-08-07  
**Date (UTC):** 2026-08-07  
**Evidence:** Clean `v1.9.15` / `ca348e79` restore → original AppShell **interactive** (maintainer). Post-tag Tor/unlock WIP discarded.  
**Parents:** [production-tor-opt-in-public-default-design-2026-07.md](./production-tor-opt-in-public-default-design-2026-07.md) · [obscur-ecosystem-charter.md](../../docs/program/obscur-ecosystem-charter.md)  
**Codebase investigation:** [tor-rust-integration-regression-investigation-2026-08.md](./tor-rust-integration-regression-investigation-2026-08.md) — **no Tor-OFF re-verify**; Option A recommended  
**Failure memory:** Enabling Tor once correlated with irreversible host freeze under post-tag WIP; Tor excision alone did not prove App Fixed while online unlock composition still thrashed.

```text
HANDOFF:              Tor + local-first Phase 2 Implemented → L3 (dial hold soak)
PAUSED / CANCELLED:   Community product · AUTH-SESSION-1 · Tor-as-default / Tor-on-unlock
CANONICAL OWNER:      local-first-runtime-policy · FullRelayProvider pool gate · Relays arm UI
L1:                   local-first-runtime-policy.test.ts · readiness copy hold path
OUT OF SCOPE NOW:     Enable Tor in Settings (Phase 3) · Thin UI · groups/**
```

### Phase 1 landed (subtraction)

| Change | Location |
|--------|----------|
| Removed Tor auto-start on shell mount | `use-auto-lock.ts` |
| Never auto-start Tor at desktop boot | `apps/desktop/src-tauri/src/lib.rs` |
| Boot clearnet net runtime (ignore stale enable_tor file for SOCKS) | `lib.rs` NativeNetworkRuntime |
| Orphan `tor.exe` kill on boot / stop / disable | `tor.rs` `ensure_tor_stopped` / `kill_orphan_tor_processes` |
| Policy gates | `local-first-runtime-policy.ts` |
| 60s FullRelay auto-arm | **Absent** on v1.9.15 tree — N/A |

Settings toggle → `save_tor_settings` + `start_tor` / `stop_tor` **retained** (explicit path only).

### Phase 2 landed (dial hold)

| Change | Location |
|--------|----------|
| Session-scoped Relays arm + `shouldHoldNetworkDial` | `local-first-runtime-policy.ts` |
| Empty pool / no bootstrap while held | `relay-provider.tsx` FullRelayProvider |
| Settings → Relays “Connect relays” CTA | `local-first-dial-arm-banner.tsx` |
| Honest copy while held | `relay-readiness-copy.ts` |

---

## Maintainer intent (2026-08-07 → reinforced)

1. Keep **original AppShell UI** (v1.9.15 tree works again).  
2. **Redesign Tor integration remains the product goal** — not permanent Tor excision.  
3. **Most of Obscur must run locally** without depending on an internet connection.  
4. Temporary “Tor OFF to survive” is **recovery**, never the destination.

### Goal preservation (do not abandon)

| Statement | Meaning |
|-----------|---------|
| “Only removing Tor makes the app work” | **App failure signal** — proves integration ownership is broken |
| Success | Tor is an **optional underlay that works** when armed; clearnet/local shell never depends on Tor |
| Historical note | Earlier full-TS Obscur could operate with Tor. Post–Rust native relay/net path **regressed** Tor: false ready, arm-before-bootstrap, SOCKS retry storms wedging the host. Rust is not the enemy; **coupling** of lifecycle owners was. |
| Forbidden conclusion | “Ship without Tor forever” / “Tor is cancelled” without feasibility doc + maintainer CANCELLED |

Temporary fail-closed (refuse dial while bootstrap incomplete, cap retries) exists so the shell can survive **while** the redesign lands — it is scaffolding toward opt-in Verified, not a product story of “we removed Tor.”

---

## Failure lessons (do not repeat)

| Anti-pattern | Why it failed |
|--------------|---------------|
| Tor process / SOCKS on UI unlock path | Host freeze; orphan `tor.exe` after disable |
| Auto-start Tor from settings/`configured` on unlock | Couples auth hydrate to network sidecar |
| TCP SocksPort open treated as READY | UI Connected at ~5% bootstrap; relays armed into dead proxy |
| `save_tor_settings(true)` immediately arms native SOCKS | Dial storm before circuit; ChunkLoadError / native queue starvation |
| Online unlock storm (FullRelay + coordination) while “fixing” Tor | Masks Tor vs clearnet owners; L1 Pass / L3 Fail loops |
| Replacing AppShell with Thin chrome as “the fix” | Interactive but unacceptable as product UI |
| Treating Tor excision as the fix | Feature deleted to hide broken owner — product regresses |

---

## Architecture principles

### P1 — Local-first default

| Surface | Default (no internet required) | Needs network (explicit arm) |
|---------|--------------------------------|------------------------------|
| Unlock / AppShell paint | Local SQLite, identity, chrome | — |
| DM / media **read** | Local DB | — |
| Profile / Settings / Vault UI | Local | — |
| Relay dial / subscribe / publish | **Held** until user arms Relays (or equivalent) | After arm |
| Tor sidecar | **Never** auto | Only Settings → enable Tor, after clearnet shell stable |
| Community / coordination HTTP | **Held** (Community PAUSED) | Separate charter |

**Invariant:** Interactive UI process must remain usable with `enable_tor=false` and zero open relay sockets.

### P2 — Tor is an optional underlay, not a boot dependency

Align with ecosystem charter: Tor is **optional policy**, not product identity.

| Rule | Detail |
|------|--------|
| Boot | `enable_tor: false` always until user toggles |
| Unlock | **Zero** Tor start, SOCKS probe, or onion dial |
| Enable path | Settings → Security/Network → Enable Tor → start sidecar → wait ready → **then** allow Tor transport pack |
| Disable path | Stop child + kill orphan `tor.exe` + clear routing arm; UI stays on clearnet/local |
| Process | Tor runs as **sidecar** with hard CPU/RAM budget; never shares unlock-critical JS work |
| Fail-closed | Tor pack Apply refused until ready; no silent clearnet when Tor-required |

### P3 — One owner per lifecycle

| Concern | Owner |
|---------|--------|
| Local-first / network arm | New policy module (name in Phase 1): e.g. `local-first-runtime-policy` — single gate for “may dial” |
| Tor process | `apps/desktop/src-tauri/src/commands/tor.rs` only |
| Transport pack Apply | Existing transport-preset apply policy (Tor gate) |
| UI chrome | AppShell (product); Thin/Trial paths **quarantine only**, not destination |

---

## Phases

| Phase | Work | Code? | Exit |
|-------|------|-------|------|
| **0** | This design + handoff cite | Docs only | Maintainer accept |
| **1** | Subtract: ensure unlock never calls `start_tor`; orphan cleanup on boot when disabled; no 60s auto-arm that remounts FullRelay | Yes — subtraction | L1 + L3: unlock AppShell ≥5 min, Tor off, no `tor.exe` |
| **2** | Explicit Relays arm before dial (local-first hold) — clearnet | Yes | L3: shell interactive with dial held; arm Relays → dial |
| **3a** | Fail-closed wedge fix: SOCKS arm only at Bootstrapped 100%; refuse dial while pending; retry cap | Yes (landed L1) | L3: stuck bootstrap does **not** wedge host |
| **3b** | Tor opt-in soak: Settings enable → honest Starting → 100% → arm routing → Relays dial via Tor | Yes | L3: Tor ON usable without ChunkLoadError; disable cleans orphan |
| **3c** | Make Rust path an **advantage**: one TorLifecycle owner, budgeted sidecar, no false ready, diagnostics honest | Yes | L3: Tor ON/OFF both host-stable; parity with “early TS + Tor worked” **intent** |
| **Later** | Community / onion-only routing — separate charters | — | Not this design |

**Phase 3 exit (Tor opt-in Verified):** App works **with** Tor when the user chooses it — not only after removing Tor.

---

## Resource budget (initial)

| Metric | Target |
|--------|--------|
| Unlock with Tor off, dial held | RSS growth ≤ 200 MB / 5 min; 0 OS freeze |
| Tor sidecar (when enabled) | Documented cap; crash of Tor must not wedge WebView |
| Concurrent dials from UI before Relays arm | **0** |

---

## Proof / claim language

| May say | Only when |
|---------|-----------|
| Design Ready | This file + handoff |
| Phase 1 Implemented | Subtraction landed; L1 green |
| Host-stable (Tor off) | L3 AppShell soak Pass |
| Tor opt-in Verified | Phase 3 L3 Pass |
| App Fixed | Not used until Tor-off host-stable **and** Tor opt-in Pass |

---

## Explicit non-goals

- Tor on by default  
- Tor start on unlock / keychain restore  
- ThinAppChrome as shipped UI  
- Re-applying discarded Trial C / host-isolation stash without a new accept  
- Community product while PAUSED  

---

## Accept checklist (maintainer)

- [ ] Local-first default + Relays arm accepted  
- [ ] Tor only via Settings after shell stable accepted  
- [ ] Phase 1 = subtraction only (no new Tor features) accepted  
- [ ] Next atomic step = Phase 1 after accept  
