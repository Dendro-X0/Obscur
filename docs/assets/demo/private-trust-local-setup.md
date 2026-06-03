# Private trust workspace — local test setup

Use this matrix after the **platform pivot** (coordination-owned membership + trusted relay only). Public relays (`nos.lol`, `groups.fiatjaf.com`, etc.) are **blocked** for new workspace communities.

## Prerequisites

- Node 20+, `pnpm install` at repo root
- Two Obscur profiles (e.g. Tester1 / Tester2) — two desktop windows or PWA + desktop

### No Docker? (coordination-only dev on your machine)

If `pnpm dev:relay` fails (common on Windows when only legacy `docker-compose` exists, or Docker is not installed), copy `apps/pwa/.env.example` to `.env.local` and ensure it includes:

```bash
NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true
```

Restart `pnpm dev:desktop`. You can **create workspace communities and test membership** (coordination directory) without a live Nostr relay. Encrypted chat publish stays local-only until a relay is available.

## 1. Start coordination (membership directory)

```bash
pnpm -C apps/coordination db:migrate
pnpm -C apps/coordination dev
```

Confirm: `curl -s http://127.0.0.1:8787/health` → `{"ok":true,...}`

## 2. Point the client at coordination

Copy `apps/pwa/.env.example` to `.env.local` (or edit an existing `.env.local`):

```bash
NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787
```

Restart `pnpm dev:desktop` (or `pnpm dev:pwa`) so the build picks up the env var.

In the app: **Settings → Relays → Community membership sync** → **Coordination preferred** (should be enabled when URL is set).

## 3. Local Nostr relay (required for Managed Workspace chat)

Membership directory uses **coordination** (`:8787`). Encrypted community **chat** still needs a Nostr relay socket.

### Start the bundled local relay (Docker)

In a **separate terminal** from coordination/desktop:

```bash
pnpm dev:relay
```

This runs `nostr-rs-relay` at **`ws://localhost:7000`** (see `infra/docker-compose.nostr.yml`).

Confirm the port is listening:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:7000/
```

Any HTTP response (often `426` or `400`) means the relay process is up.

Stop when done: `pnpm dev:relay:down`

### Configure Obscur

1. **Settings → Relays**
2. Add or enable **`ws://localhost:7000`** (not `7001` — older builds used the wrong default port).
3. Set it as **primary** (badge shows **Connected** after **Refresh Status**).
4. Leave public relays (`nos.lol`, `damus.io`, …) **disabled** for workspace tests — Managed Workspace blocks them as community hosts.

**Create group → Relay host:** pick `localhost:7000` when it shows **Connected** (not Disconnected).

| Mistake | Symptom |
|---------|---------|
| Coordination not running | Create blocked or “coordination membership publish failed” |
| Relay not running | `localhost:7000` = **Disconnected** in dropdown; Create disabled |
| Wrong port `7001` | Disconnected — nothing listens on 7001 |
| Public relay as host | Red banner — public relays cannot host workspace |

## 4. Create workspace (Tester1)

1. Network → **Create group**
2. Host: `127.0.0.1` or your team relay hostname (not `nos.lol`)
3. Mode: **Managed Workspace** (only option)
4. Create — expect coordination join publish; group appears locally

## 5. Invite and join (Tester2)

1. Tester1 invites Tester2 from community page
2. Tester2 accepts in DM — trust gate must pass (coordination healthy + non-public relay)
3. Coordination publishes **join** delta for Tester2

## 6. Verify membership (K-M1 / K-M2)

**Full session steps:** [k-m1-k2-session-runbook.md](./v1.9.0/k-m1-k2-session-runbook.md)

| Step | Tester1 | Tester2 | Pass |
|------|---------|---------|------|
| Leave | Leave community | Participants → A under **Excluded** ≤ ~60s | |
| Offline | Leave | Close app 5+ min, reopen | B applies head/deltas |

Use **Reconcile membership** on group home if roster lags.

## Purge a test workspace (backend + local)

With Obscur **fully quit**:

```bash
pnpm purge:workspace              # removes NewTest* groups + coordination D1
pnpm -C apps/coordination db:purge-membership   # coordination only
```

Uses profile `default` WebView data under `%APPDATA%\app.obscur.desktop\profiles\default\EBWebView`.
For Tester2: `node scripts/purge-workspace-communities.mjs --match NewTest --profile profile-2`

## Emergency recovery (UI frozen on launch)

If the desktop window is unresponsive and you cannot open Settings:

1. **Quit Obscur completely** (close the Tauri window and stop `pnpm dev:desktop` with Ctrl+C).
2. **Clear the stuck “last opened chat” pointer** (DevTools not required):
   - In a regular browser at `http://127.0.0.1:3340`, open DevTools → Application → Local Storage → `http://127.0.0.1:3340`
   - Delete keys matching `obscur-last-chat-*` for your profile
   - Or run in the console: `Object.keys(localStorage).filter(k => k.includes('obscur-last-chat')).forEach(k => localStorage.removeItem(k))`
3. **Restart** `pnpm dev:desktop` and open **Settings → Relays** before selecting a workspace group.
4. Optional: comment out `NEXT_PUBLIC_COORDINATION_URL` in `apps/pwa/.env.example` until coordination is running, then restore it.

Workspace groups created with host `127.0.0.1` are **coordination-only** until you add a real `wss://` relay URL.

## Desktop cannot reach coordination (curl works, app shows unreachable)

This is usually **not** an internet or VPS issue — `curl http://127.0.0.1:8787/health` uses the OS network stack; the desktop shell uses a WebView that may block loopback `fetch` until native HTTP is enabled.

1. Fully restart `pnpm dev:desktop:online` (not just refresh) after pulling coordination-fetch fixes.
2. Keep `pnpm -C apps/coordination dev` running.
3. If the create dialog still blocks: **Settings → Relays → Operator setup** → enable **Test without local Nostr relay** → enable **Trust local coordination (curl verified)** → **Apply operator bundle**.

That unblocks the UI for local workspace testing. Membership publish may still fail until the app can POST to coordination; treat that as **environment-limited** client evidence, not a product sign-off for multi-client membership.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `db:migrate` — D1 name not found | Use `pnpm -C apps/coordination db:migrate` (D1 name is **`obscur`**, matching `wrangler.toml`). Restart `pnpm -C apps/coordination dev` after migrate. |
| Wrangler `no such table: community_membership_deltas` | Schema not applied — run `db:migrate` above, then retry create / **Reconcile membership** |
| Create disabled — coordination | Start `apps/coordination` dev; check `.env.local` URL; restart app |
| Create disabled — public relay | Change host away from nos.lol / fiatjaf / damus defaults |
| Join toast — coordination publish failed | Coordination not running, wrong URL, D1 schema missing, or (desktop) identity key not resolved for signing — rebuild after fix; toast may show `sign_failed` / `http_401` / `native_signing_unavailable` |
| UI freeze / extreme lag | Often `127.0.0.1` host without `wss://` relay — old builds spammed all relays; run `db:migrate`, restart desktop, add a real `wss://` relay for chat |
| Chat publish fails | Add/enable shared `wss://` relay; both clients connected |

## References

- [platform-pivot-private-trust-2026-05.md](../../program/platform-pivot-private-trust-2026-05.md)
- [v1.9.0 demo matrix](./v1.9.0/README.md) K-M1–K-M2
