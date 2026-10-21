# L2 soak — Matrix HS + Tor transport (Track C)

**Date (UTC):** 2026-10-17  
**Status:** L1 Pass · Atom B T0 Pass / T1 Fail (host TLS_ERROR @10%) · Atom A pending HS  
**Parents:** [protocol-adaptation-transport-c1-design-2026-10.md](./protocol-adaptation-transport-c1-design-2026-10.md) · [protocol-adaptation-matrix-c2-design-2026-10.md](./protocol-adaptation-matrix-c2-design-2026-10.md) · [tor-smoke-verification-ritual-2026-10.md](./tor-smoke-verification-ritual-2026-10.md)

```text
HANDOFF ATOMIC STEP: L2 Matrix/Tor desktop soak (after C0–C3 L1)
PAUSED / CANCELLED: Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified (T5)
CANONICAL OWNER: ProtocolAdaptationLayer · applyActiveTransport · MatrixAdapter · Tor gateway IPC
PROOF: L1 automated below · L2 = Pass/Fail rows in this checklist (desktop)
```

## What this is / is not

| Is | Is not |
|----|--------|
| Desktop manual confirmation C1 Tor + C2 Matrix HS work | Tor-only **Verified** (T5) |
| Stop at T0–T4 smoke language if Tor Ready | Soft L3 Fixed / remount / uncapped Quiet |
| Two independent atoms (A Matrix · B Tor) | Matrix Olm E2EE |

## L1 preflight (automated)

```bash
pnpm -C apps/pwa exec vitest run app/features/protocol-adaptation
pnpm verify:tor-gateway
```

Record date + Pass/Fail in handoff checkpoint.

## Atom A — Matrix HS (clearnet first)

### Credentials (do not paste into chat / do not commit)

Put in `apps/pwa/.env.local` (gitignored):

```bash
OBSCUR_MATRIX_HS_URL=https://matrix.org   # or your HS
# Password path (if HS password login works):
OBSCUR_MATRIX_USER=@you:server            # or localpart
OBSCUR_MATRIX_PASSWORD=...
# OR access-token path (SSO / Element — no password):
# OBSCUR_MATRIX_ACCESS_TOKEN=...
# OBSCUR_MATRIX_USER=@you:server          # optional; whoami wins
# optional — enables A3 send in headless script
OBSCUR_MATRIX_ROOM_ID=!room:server
```

Headless API soak (A1–A3):

```bash
node scripts/matrix-atom-a-soak.mjs
```

Desktop UI soak (A1–A5): Settings → Protocols → password **or** access-token fields.

| # | Step | Pass |
|---|------|------|
| A1 | Login HS (password or access token / whoami) | Session / access_token |
| A2 | Sync / room list | Joined rooms (may be 0) |
| A3 | Send text (needs `OBSCUR_MATRIX_ROOM_ID` or UI room) | `event_id` or timeline |
| A4 | Switch protocol → Nostr (desktop) | Nostr surfaces return |
| A5 | Capabilities chips / media gate (desktop) | Match Matrix capabilities |

**Claim if A1–A3 Pass (script):** `L2 Matrix HS API soak Pass`.  
**Claim if A1–A5 Pass (desktop):** `L2 Matrix HS soak Pass` (clearnet).

## Atom B — Tor transport (stop before Verified)

Reuse [tor-smoke-verification-ritual-2026-10.md](./tor-smoke-verification-ritual-2026-10.md) T0–T4 only.

| # | Step | Pass |
|---|------|------|
| B0 | Tor OFF · clearnet usable (≥1 relay or local) | Shell usable |
| B1 | Settings Network = Tor (or Tor ON) | Gateway/sidecar starts (T0) |
| B2 | Wait Ready / Bootstrapped 100% (≤5 min) | T1 Pass — else record T1 Fail · stop |
| B3 | Optional: curl SOCKS `check.torproject.org` | T3 underlay smoke |
| B4 | App dials while Tor armed; Tor OFF → clearnet recovers | T4 language OK |
| B5 | **Do not** run T5 A+B+C | — |

**Claim if B0–B2 Pass:** `L2 Tor transport smoke Pass` (lifecycle).  
**Claim if B0–B4 Pass:** `L2 Tor app-routed smoke Pass`.  
**Never claim:** Tor Verified.

## Optional Atom C — Matrix + Tor together

Not required for L2 ask. Adapter records transport; HTTPS may need OS/gateway SOCKS. Record observations only.

## Evidence stamp (maintainer fills)

| Atom | Result | Notes / date |
|------|--------|--------------|
| L1 protocol-adaptation | **Pass** | 2026-10-17 · vitest 34/34 |
| L1 `verify:tor-gateway` | **Pass** | 2026-10-17 · 17/17 |
| A Matrix HS | **Skipped** | 2026-10-17 · `@dendro:matrix.org` via SSO; no password for `m.login.password`; maintainer skip (session key ≠ login) |
| B Tor T0 (gateway) | **Pass** | 2026-10-17 · `:17950` health ok (re-probe same day) |
| B Tor T1 (Ready) | **Fail** (×2) | Stuck 10% · `TLS_ERROR` · see [tor-t1-knottrace-boundary-investigation-2026-10.md](./tor-t1-knottrace-boundary-investigation-2026-10.md) |
| B Tor T2–T4 | skipped | blocked on T1 |
| Tor Verified | **not claimed** | PAUSED |
| KnotTrace | sibling | Local DNS/link/MTU honesty — **does not** fix Tor directory TLS block |

_Last updated: 2026-10-17T13:25:00Z_
