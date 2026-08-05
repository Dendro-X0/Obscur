# Investigation — Production ≠ development parity collapse (v1.9.14)

**Status:** Active recovery · 2026-07-28  
**Symptom:** Packaged / release desktop unusable (account + relays); only “clone + `pnpm dev:desktop`” appears to work  
**Band:** Full Release recovery — **demo/recording frozen** until parity gate green  
**Out of scope:** AUTH-SESSION-1 silent unlock revival · community roster · claiming “release fixed” without L3

---

## Verdict

This is a **product delivery failure**, not a demo polish issue.

**Policy (2026-07-28 recovery):** default `pnpm dev:desktop` **is** the packaged contract (live relays, no offline stub, no DEV_LAB). Offline stub is opt-in (`--offline` / `pnpm dev:desktop:stub`).

| Surface | Default `dev:desktop` (after recovery) | Packaged / `desktop:build:exe` |
|---------|----------------------------------------|--------------------------------|
| `EXPERIMENT_ONLINE` | **1** (live relays) | **1** |
| `DEV_LAB` | unset / false | unset / false |
| Relay sockets | Conduit Mesh → NativeRelay → Rust | same |
| Shell freshness | rebuild on mode/stale mismatch | refuse offline/stale `--skip-shell` |

Next HMR (`dev:desktop:live`) remains a **UI iteration** tool — it is not package parity and must not be used to greenlight release.

---

## Parity contract (non-negotiable)

Release / demo may resume only when **all** pass on **release exe** (`obscur_desktop_app.exe` or installer):

| # | Gate | Pass |
|---|------|------|
| P1 | Shell manifest | `experimentOnline=true`, `desktopShell=true`, not stale vs sources |
| P2 | Account | Create + unlock (or unlock existing) lands in shell |
| P3 | Relays | With Tor **off**, at least one public relay leaves “offline” |
| P4 | Refresh | F5 exits “Restoring session…” ≤ ~2.5s (login or shell; no infinite hang) |

Any fail → **release blocked**.

---

## Owners

| Failure class | Canonical owner | Spec / code |
|---------------|-----------------|-------------|
| Offline stub vs live | `experiment-shell-policy.ts` + `dev-desktop-static.mjs` + `build-pwa-shell.mjs` | This doc |
| Stale prod shell bake | `desktop-build-exe.mjs` `--skip-shell` | refuse unless online + fresh |
| Packaged relays offline | `conduit-mesh-nostr-ws-client.ts` + `native-relay.ts` | `desktop-packaged-relay-offline-investigation-2026-07.md` |
| F5 hang | `auth-gateway.tsx` | `auth-gateway-reload-restore-hang-investigation-2026-07.md` |

---

## Recovery ladder (enforced)

1. `pnpm desktop:demo-preflight` — L1 + shell manifest check  
2. `pnpm desktop:build:exe` — **rebuild shell** (no blind `--skip-shell`)  
3. Smoke P2–P4 on release exe  
4. Only then `pnpm desktop:package`  
5. Record / ship  

Day-to-day: `pnpm dev:desktop` (parity). Stub: `pnpm dev:desktop:stub`.

---

## Claim language

| Phrase | Allowed when |
|--------|----------------|
| Implemented | Gate scripts + default desktop = production contract |
| Verified (L1) | Named vitest / shell-manifest checks green |
| Fixed (runtime) | P2–P4 green on release exe (L3) |
| Release ready | P1–P4 + one `desktop:package` artifact smoked |
