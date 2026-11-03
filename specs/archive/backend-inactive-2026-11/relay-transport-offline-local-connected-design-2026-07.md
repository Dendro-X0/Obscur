# Design — Transport false-offline: promote connected local mesh

**Status:** Ready to implement  
**Date:** 2026-07-31 (UTC)  
**Investigation:** [relay-transport-offline-local-connected-investigation-2026-07.md](./relay-transport-offline-local-connected-investigation-2026-07.md)  
**Handoff atomic:** Wave A — Transport false-offline

---

## Session gate

```text
NEXT ATOMIC STEP:     Wave A — Transport false-offline
CANONICAL OWNER:      resolveDmTransportRelayUrls + resolveActivePoolRelayUrls (+ existing reconcile)
PROOF:                L1 vitest · desktop evidence that local CONNECTED ≠ 0 writable solely from dead public primary
OUT OF SCOPE:         Third-party host “fixes” · second publish path · production community un-pause
```

---

## Goal

When the user has enabled local-dev mesh (`ws://localhost:7000`) and that socket is open, product readiness must count it and basic-mode active pool / primary recovery must promote it if the public primary has zero open sockets — without inventing a parallel publish owner or claiming public Nostr is healthy.

---

## Changes (smallest)

### 1. DM scope — always append enabled local-dev WS

**File:** `apps/pwa/app/features/relays/services/relay-transport-scope.ts`

- Remove the `isExperimentOnlineEnabled()` gate around appending enabled `isLocalDevWorkspaceRelayUrl`.
- Keep behavior: public DM URLs stay first; local-dev is last fallback (same as today’s experiment-online path and loopback HTTP mesh).
- Classification stays `community_candidate` for UI partitioning; only the **DM pool membership** for enabled local-dev changes.

### 2. Basic active pool — promote open standby when primary is dead

**File:** `apps/pwa/app/features/relays/services/relay-primary-selector.ts`

In `resolveActivePoolRelayUrls` for `mode === "basic"`:

- If primary is open or writable → keep `[primary]` (unchanged).
- If primary has no open/writable hint and another ordered URL is open/writable → return `[bestOpen]` so recovery metrics / sockets treat the live relay as active immediately.
- Existing `reconcilePrimarySelection` already switches primary when `!currentHint?.isOpen && best isOpen` once local is in `orderedEnabledUrls`.

### 3. No new owners

- Do not change publish pipelines.
- Do not force public relays healthy.
- Custom-node merge may remain for other community candidates; local-dev now also participates in DM ordered list when enabled.

---

## Tests (L1)

| Case | Expect |
|------|--------|
| `resolveDmTransportRelayUrls` with experiment online **false**, damus + localhost enabled | `[damus, localhost]` |
| Existing experiment-online append test | Still passes (same ordering) |
| Basic pool: primary damus closed, local open in ordered list | Active pool `[localhost]` |
| `reconcilePrimarySelection`: damus closed, local open | Primary → localhost |
| Readiness detail: writableCount > 0 | Not “0 writable” offline detail for that snapshot |

---

## Desktop evidence (L3-lite)

After apply, with local mesh CONNECTED and public primary DISCONNECTED:

- Banner must not show `0 writable` solely because public primary is dead.
- ACTIVE TRANSPORT / primary should reflect a writable open relay when one exists.
- Record public TCP/WS probe separately; do **not** claim “public Nostr fixed.”

---

## Desktop / probe evidence (2026-07-31)

### L1

```text
pnpm -C apps/pwa exec vitest run \
  app/features/relays/services/relay-transport-scope.test.ts \
  app/features/relays/services/relay-primary-selector.test.ts \
  app/features/relays/services/relay-readiness-copy.test.ts
→ 3 files · 31 Pass
```

Screenshot scenario covered in L1:

- enabled local-dev joins DM pool without experiment-online gate
- basic active pool promotes open `ws://localhost:7000` when damus is closed
- reconcile switches primary to open local
- readiness queue hint null when `writableRelayCount >= 1`

### External probe (not an app fix)

| Host | TCP | TLS |
|------|-----|-----|
| relay.damus.io:443 | OK | FAIL (socket disconnected before secure establish) |
| nos.lol:443 | OK | OK |
| relay.primal.net:443 | OK | OK |
| localhost:7000 | OK | n/a |

**Claim:** Transport false-offline **fixed** at owner level (L1). Public Nostr **not** claimed fixed (damus TLS fail is provider/path). Full UI desktop re-soak: reload shell with Local Dev Mesh enabled + dead public primary → banner must not show `0 writable` solely from that primary.

### Desktop L3-lite (2026-07-31) — sequence C

```text
pnpm verify:wave-a-transport-l3
→ pass=true writable=1 readiness=degraded localEnabled=true falseOffline=false
→ report: test-results/wave-a-transport-l3-2026-07-31.json
```

Notes: probe unlocks Tester1 after soft reload (locked shell → writable=0 is auth, not Wave A). Local remains in enabled DM list; writable≥1 with readiness `degraded` (public primary still unhealthy). **Not** a public Nostr fix.

---

## Mental simulation

1. User enables Local Dev Mesh + public defaults; basic mode; damus selected primary.
2. Damus WS dies; localhost stays open via pool/custom merge.
3. Local is in DM ordered list → health hint `isOpen` for localhost.
4. Reconcile + basic pool promotion → active = localhost; metrics writable ≥ 1.
5. Banner leaves false offline; DMs can use the live local relay evidence path.
6. Neighbors: community_candidate UI partition unchanged; public-only users unaffected; disabled localhost still excluded.
