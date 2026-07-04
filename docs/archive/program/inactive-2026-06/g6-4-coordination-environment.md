# G6-4 — Coordination environment (desktop)

**Goal:** Run the Cloudflare coordination worker locally and prove the **desktop app** can reach it (membership directory probes + optional publish), without blocking other desktop work when loopback fails.

Canonical gate: [phase3-desktop-online-gate.md](./phase3-desktop-online-gate.md) · Workspace flows: [private-trust-local-setup.md](../assets/demo/private-trust-local-setup.md)

---

## Terminal layout

| Terminal | Command | Pass signal |
|----------|---------|-------------|
| **A** | `pnpm coordination:migrate` (once) then `pnpm dev:coordination` | `pnpm coordination:health` → `{"ok":true,...}` |
| **B** | `pnpm dev:desktop:online` | App unlocks; DM/relays work (your current soak) |
| **C** (optional) | `pnpm dev:relay` | `ws://localhost:7000` **Connected** — only for workspace **chat**, not G6-4 |

---

## Client config (already on this machine)

`apps/pwa/.env.example` (copy to `.env.local` for local builds) should include:

```bash
NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787
```

Optional (membership without Nostr relay):

```bash
NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true
```

Restart desktop after changing env (`Ctrl+C` → `pnpm dev:desktop:online`).

---

## Sign-off script (P3-9 … P3-12)

| Step | Action | Pass when |
|------|--------|-----------|
| **P3-9** | `pnpm coordination:migrate` then `pnpm dev:coordination` | `pnpm coordination:health` OK |
| **P3-10** | Desktop online + Settings → Relays → **Community membership sync** | Coordination **configured**; probe healthy or degraded — **no crash overlay** |
| **P3-11** | Stop terminal A (coordination) | App stays navigable; membership shows **degraded** / unreachable |
| **P3-12** | Restart `pnpm dev:coordination` | Health recovers within ~15s (probe cache) without full app restart |

### Loopback blocked in WebView (historical maintainer issue)

`curl` / `pnpm coordination:health` OK but create dialog still blocks:

1. **Settings → Relays → Operator setup (private trust)**
2. Enable **Trust local coordination (curl verified)** (assume-local reachable)
3. Optionally **Test without local Nostr relay** if you are not running `pnpm dev:relay`
4. **Apply operator bundle**

Native HTTP uses `@tauri-apps/plugin-http` with allowlist `http://127.0.0.1:*` in `apps/desktop/src-tauri/capabilities/desktop.json`. Full restart required after pulling coordination-fetch changes.

### Automated evidence (no worker required)

```bash
pnpm test:coordination-worker
pnpm verify:phase3
```

---

## What G6-4 is / is not

| In scope | Out of scope |
|----------|----------------|
| `/health` probe from desktop | Full two-client workspace manual matrix (K-M1…) |
| Fail-open when worker stopped | Play Console / production VPS (optional later) |
| Membership directory POST when app can sign | Android wrap-up |

**Sign-off rule:** Record P3-9…P3-12 in [phase3-desktop-online-gate.md](./phase3-desktop-online-gate.md). If P3-10 POST still fails but P3-9 + P3-11 + P3-12 pass, note **environment-limited** — same as handoff G6-4 deferral.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `wrangler dev` hangs on first run | Wait 1–2 min; ensure Node 20+; try `pnpm coordination:migrate` in another terminal first |
| `no such table` on membership | `pnpm coordination:migrate` |
| Health OK, app unreachable | Operator setup assume-local; restart desktop; try `http://localhost:8787` override in wizard |
| Create needs chat relay | `pnpm dev:relay` + `ws://localhost:7000` as primary — separate from coordination |
