# K-M1 / K-M2 — session runbook (v1.8.x batch exit)

**Goal:** Prove coordination membership convergence when profile A leaves and profile B sees A under **Excluded**.

**Matrix:** [README.md](./README.md) · **Setup:** [private-trust-local-setup.md](../private-trust-local-setup.md)

---

## Before you start

| Check | Command / action |
|-------|------------------|
| `.env.local` exists | Copy `apps/pwa/.env.example` → `apps/pwa/.env.local` |
| Coordination URL set | `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` |
| Two profiles ready | Tester1 (dark) + Tester2 (light) — two desktop windows or PWA `:3340` + desktop |

---

## Terminal layout (3 windows)

```bash
# T1 — coordination (keep running; cold start can take 2–4 min on Windows)
pnpm coordination:migrate    # once per schema change; retry if wrangler times out
pnpm dev:coordination
pnpm coordination:health     # expect {"ok":true,...}

# T2 — relay (optional for chat; membership uses coordination only)
pnpm dev:relay               # ws://localhost:7000 — skip if coordination-only mode

# T3 — app instance A
pnpm dev:desktop:online

# T4 — app instance B (second window after profile 2 unlock, or stack-only + second desktop)
pnpm dev:desktop:online      # or open Profile 2 → "Open in new window"
```

**Coordination-only shortcut:** With `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true`, you can run K-M1/K-M2 **without** Docker relay — roster/leave uses coordination directory only.

---

## App configuration (both profiles)

1. **Settings → Relays → Community membership sync** → **Coordination preferred** (enabled when URL is set).
2. If create is blocked but `curl` health works: **Operator setup** → **Trust local coordination (curl verified)** → **Apply operator bundle**.
3. For chat after join: enable **`ws://localhost:7000`** as primary relay (both profiles).

---

## Create test workspace

| Step | Tester1 | Tester2 |
|------|---------|---------|
| 1 | Network → **Create group** → Managed Workspace | — |
| 2 | Host: `127.0.0.1` or `localhost:7000` (Connected) | — |
| 3 | Name: `NewTest-KM-<date>` | — |
| 4 | Invite Tester2 from group home | Accept in DM (trust gate must pass) |
| 5 | Both open group → **Participants** | Both listed as active |

If roster lags: group home → **Reconcile membership**.

---

## K-M1 — B online when A leaves

| Step | Actor | Action | Pass when |
|------|-------|--------|-----------|
| 1 | Tester1 | Open Participants modal; note B is active | Baseline |
| 2 | Tester2 | Keep app open on same relay/coordination | Online observer |
| 3 | Tester1 | **Leave community** | — |
| 4 | Tester2 | Participants modal within **~60s** | Tester1 under **Excluded from active roster** |
| 5 | Tester2 | Re-invite control | Enabled for excluded member |

**Evidence:** screenshot → `docs/assets/demo/v1.9.0/evidence/K-M1-tester2-YYYY-MM-DD.png`

---

## K-M2 — B offline when A leaves

| Step | Actor | Action | Pass when |
|------|-------|--------|-----------|
| 1 | Recreate workspace (or use fresh `NewTest-KM2-*` group) | Both joined | Clean state |
| 2 | Tester2 | **Quit Obscur completely** | Offline |
| 3 | Tester1 | **Leave community** | — |
| 4 | Wait | **5+ minutes** | — |
| 5 | Tester2 | Reopen app → open same group → Participants | Same as K-M1: A under **Excluded** |

**Evidence:** `K-M2-tester2-YYYY-MM-DD.png`

---

## Sign-off

Update pass column in [README.md](./README.md):

```markdown
| K-M1 | | | | Pass YYYY-MM-DD — excluded ≤60s |
| K-M2 | | | | Pass YYYY-MM-DD — head applied on reopen |
```

Update [deferred-manual-verification-checklist.md](../../../program/deferred-manual-verification-checklist.md) §6 rows K-01, K-02.

---

## Cleanup

```bash
pnpm purge:workspace
# Tester2 profile data:
node scripts/purge-workspace-communities.mjs --match NewTest --profile profile-2
```

---

## B2 bot key (after K-M pass)

Do **not** use raw `node -e` with `@noble/curves` — resolution fails outside the script bundle.

```bash
pnpm community-bot:generate-key -- --nsec
```

Register printed pubkey in **Manage → General → Outbound bots**, configure **Inbound triggers (B2)**, then run `pnpm community-inbound-bot` with env from [community-inbound-bot.md](../../../messaging/community-inbound-bot.md).
