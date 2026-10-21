# Ritual — Tor smoke verification (honest ladder)

**Date (UTC):** 2026-10-10  
**Status:** Operator / maintainer ritual · **not** a substitute for Tor-only Verified  
**Parents:** [tor-transport-mode-design-2026-08.md](./tor-transport-mode-design-2026-08.md) · [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md) · [tor-verified-infeasible-2026-08.md](./tor-verified-infeasible-2026-08.md) · [network-infrastructure-module-charter-2026-10.md](../../docs/program/network-infrastructure-module-charter-2026-10.md)

```text
GOAL:     Know which Tor layer works on THIS machine — with typed evidence
NOT:      Claim “Tor Verified” from SocksPort up · or from clearnet DMs with Tor toggle ON but unarmed
```

---

## 1. Layers (stop at first Fail)

| Layer | Question | Pass looks like | Fail ≠ product death |
|-------|----------|-----------------|----------------------|
| **T0** | Sidecar process | `tor` / gateway running after Settings Tor ON | Binary/path/start bug |
| **T1** | Bootstrap | Log / UI: **Bootstrapped 100%** · `ready=true` | Env/DPI — common here (INFEASIBLE verify surface) |
| **T2** | Transport armed | Explicit **Route traffic via Tor** · `transportArmed=true` | User never armed — clearnet still OK by design |
| **T3** | SOCKS path live | HTTP(S) or WS through SOCKS succeeds | Circuit/exit/CF — not “toggle broken” |
| **T4** | App dials via Tor | Relay open **while armed** · clearnet path not used for that dial | Mesh still clearnet if !armed |
| **T5** | Sticky + regression | Full [T5 A+B+C](./tor-t5-l3-soak-checklist-2026-08.md) | Only then **Tor-only Verified** |

**Claim map**

| Evidence | May say |
|----------|---------|
| T0–T1 | Tor lifecycle **smoke Pass** (sidecar + bootstrap) |
| T0–T3 | Tor **underlay smoke Pass** |
| T0–T4 | Tor **app-routed smoke Pass** |
| T5 A+B+C | **Tor-only Verified** (requires Tor-capable net) |
| T1 Fail on this LAN | Host **infeasible for Tor Ready** — keep clearnet product |

---

## 2. In-app ritual (desktop)

Do in order; record Pass/Fail.

### Step 0 — Baseline clearnet (1 min)

- [ ] Tor **OFF** · **Use clearnet**  
- [ ] ≥1 public relay open **or** local `ws://localhost:7000` enabled+open  
- [ ] Note: shell usable  

→ Proves app not wedged before Tor.

### Step 1 — Sidecar (T0)

- [ ] Settings → enable Tor (sidecar / gateway co-start)  
- [ ] Do **not** expect relays to switch yet  
- [ ] Evidence: process running · UI “starting/connected” for **sidecar**, not “privacy routed”  

### Step 2 — Bootstrap (T1)

- [ ] Wait for **Bootstrapped 100%** / Ready (timeout: 3–5 min)  
- [ ] If stuck ~10–14% / TLS_ERROR: **stop** — record T1 Fail · do not patch-loop · turn Tor OFF  

### Step 3 — Arm (T2)

- [ ] Only if T1 Pass: **Route traffic via Tor** (`transportArmed`)  
- [ ] Confirm UI distinguishes Ready vs privacy-routed  

### Step 4 — Underlay check (T3) — outside or via host

Pick one:

**A — curl via SOCKS** (if you know SocksPort, often `9150` / app-configured):

```bash
curl -sI -m 30 --socks5-hostname 127.0.0.1:9150 https://check.torproject.org/api/ip
```

Pass: JSON/`IsTor` true or check page says Tor.  
(Adjust port to Settings / torrc SocksPort.)

**B — App-only:** after arm, open Relays · expect publics may fail on CF; honesty copy OK. For T3 Pass prefer A or onion WS.

### Step 5 — App-routed (T4)

- [ ] Armed · dial a **Tor-viable** target (prefer `….onion` WSS if you have one; lab localhost via Tor is weak proof)  
- [ ] Sticky open ≥2 min without reconnect storm  
- [ ] **Disarm / Tor OFF** → clearnet pool recovers (regression)

### Step 6 — Full Verified (T5)

Only on a **Tor-capable** network: run [tor-t5-l3-soak-checklist](./tor-t5-l3-soak-checklist-2026-08.md) A+B+C and paste evidence block.  
Do **not** stamp Verified from this ritual alone on a historically blocked LAN.

---

## 3. Evidence paste (copy to EG-LOG or handoff)

```text
Tor smoke 2026-10-__:
  T0 sidecar:     Pass|Fail —
  T1 bootstrap:   Pass|Fail — % / notes
  T2 armed:       Pass|Fail|Skip —
  T3 SOCKS check: Pass|Fail|Skip — port= · result=
  T4 app dial:    Pass|Fail|Skip — url=
  T5 Verified:    not attempted | blocked host | see T5 checklist
  Clearnet after: Pass|Fail — Tor OFF still usable
  Claim: smoke-T0..Tn | none | (never Verified from smoke alone)
```

---

## 4. What “Tor is working” means in conversation

| Phrase | Safe if |
|--------|---------|
| “Tor starts” | T0 |
| “Tor is ready” | T1 |
| “Traffic goes through Tor” | T3 or T4 |
| “Tor Verified” | T5 A+B+C only |
| “Product needs Tor to ship” | **False** — clearnet ship settled |

---

## 5. Today’s host (expectation)

Prior evidence: Tor bootstrap often stalls on this LAN; public clearnet Nostr was also path-filtered then recovered.  

**Reasonable goal this session:** complete **T0 → T1** (or document T1 Fail) + always **Tor OFF clearnet still works**.  
Defer T5 Verified until a capable network or external tester.

---

**Assistant lock:** Laddered proof. No Verified theater. NIM/Tor seamlessness = arm/disarm + honesty, not latency miracles.
