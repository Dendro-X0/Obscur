# T1 private-trust standup — SOP draft (PB1-B)

**Status:** Draft · stranger-readable happy path · **PB1-B L1 linked** from PRODUCTIZATION (2026-10-13)  
**Date (UTC):** 2026-10-13  
**Band:** Pre-B2B PB1-B · serves S2 self T1 / H1 standup  
**Parents:** [pre-b2b-capability-design-2026-10.md](../../specs/backend/pre-b2b-capability-design-2026-10.md) §4 · [self-hosted-relay-vps-operator-notes-2026-08.md](./self-hosted-relay-vps-operator-notes-2026-08.md) · [PRODUCTIZATION.md](../business/PRODUCTIZATION.md) §4–§5  
**Not this doc:** Conference video (M1–M3) · dialects · Tor-as-blocker · public Quiet SLA · shell freeze optimization

---

## Goal

One path a hitch or operator can follow **without Slack**:

install → (optional) own relay → bind client → first identity → first DM → first small group.

Clearnet demo path is first-class. Tor stays optional and must not block this pack.

---

## 0. Before you start

| Need | Notes |
|------|--------|
| Desktop | Official installer from Gift `/download` or a release build |
| Two accounts | Two profile windows / machines, or two Obscur profiles on one machine |
| Relay | Lab: `ws://localhost:7000` · Remote team: your `wss://…` (see self-hosted notes) |
| Coordination (managed workspace only) | Local `http://127.0.0.1:8787` or operator URL — **not** required for sealed cell / sovereign room |

**Honesty limits (say up front):**

- Video conferencing is **not** supported (1:1 voice only).  
- Public default relays (nos / primal / damus) are fine for DM rendezvous; they are **not** a Managed Workspace SLA.  
- Soft Lock can leave the shell looking unlocked while SQLite is closed — unlock with device password / Import Key if send says “Local database is locked.”

---

## 1. Install desktop

1. Get the official desktop build (Gift download page or release artifact).  
2. Install and launch Obscur.  
3. Confirm you can open **two profiles** (or two machines) for the proof pack.

---

## 2. Operator secrets (only if self-hosting)

Skip this section for pure localhost lab with repo defaults.

If you run your own relay / coordination:

1. Generate and store operator secrets **off-chat** (password manager / sealed ops note).  
2. Follow topology A or B in [self-hosted-relay-vps-operator-notes-2026-08.md](./self-hosted-relay-vps-operator-notes-2026-08.md).  
3. Prefer **WSS** beyond LAN; raise proxy idle timeouts.  
4. Do **not** put nsec / PDK / coordination admin tokens in group chat.

---

## 3. Bind client to the agreed relay

### Lab (Track L / self T1 clearnet)

1. Start workspace stack (`relay :7000`, coordination if needed).  
2. **Settings → Relays → Operator setup:** Save workspace relay as `ws://localhost:7000` (this keeps the lab dialed even when public Default Stable remotes stay on).  
3. Confirm `ws://localhost:7000` is **enabled** in the relay list.  
4. Tor preference **OFF** for this pack.  
5. Public remotes may stay enabled for DM rendezvous; cell/group traffic should use the saved lab workspace relay.

### Operator WSS

1. Add `wss://relay.yourdomain` in Settings → Relays.  
2. Prefer a **trusted private / intranet** host for Managed Workspace creates.  
3. Public Quiet hosts may create **Sovereign Room** cells only; Managed Workspace create stays blocked on public defaults.

---

## 4. First identity · first DM · first group

### Identity

1. Create or unlock **Tester A** (profile 1).  
2. Create or unlock **Tester B** (profile 2).  
3. Set display name + avatar; publish profile if you use discovery.

### DM

1. From A, find/add B (invite code, search, or known pubkey).  
2. Accept trust / connection as your product path requires.  
3. Send ≥1 text each direction.  
4. Optional: one voice note or 1:1 voice call — expect honest fail copy if the call drops (not a silent hang).

### Small group (P5)

1. On A, create a **Sovereign Room** (cell) on the agreed relay (`localhost:7000` or private WSS).  
2. Invite B.  
3. Both send ≥1 line in the group.  
4. If send fails with **Local database is locked**, unlock storage (device password / Import Key), then retry — do not treat it as a relay outage.

Record markers / notes in [EG-LOG.md](../business/EG-LOG.md) when the pack completes (**Result: group live**).

---

## 5. Handoff (who holds what)

Write this once per standup (customer or self):

| Item | Owner |
|------|--------|
| Account keys (nsec / recovery) | Named human(s) — not Obscur HQ |
| Device unlock / PDK | Device owner |
| Relay host + TLS | Operator (or lab default) |
| Coordination URL (if managed) | Operator |
| Data root / backups | Device + operator policy |
| How to revoke a device | Lock profile · rotate keys · remove trust · (optional) wipe profile data |

---

## 6. Done when

- [ ] Two identities unlock on clearnet  
- [ ] DM both ways  
- [ ] Small group invite + dual send  
- [ ] Limits spoken: no video conference · Tor optional · Quiet ≠ managed SLA  
- [ ] EG-LOG or hitch note points here  

---

## Related

- [self-hosted-relay-vps-operator-notes-2026-08.md](./self-hosted-relay-vps-operator-notes-2026-08.md)  
- [pre-b2b-capability-and-media-roadmap-2026-10.md](./pre-b2b-capability-and-media-roadmap-2026-10.md)  
- [EG-LOG.md](../business/EG-LOG.md) · [PRODUCTIZATION.md](../business/PRODUCTIZATION.md)  
