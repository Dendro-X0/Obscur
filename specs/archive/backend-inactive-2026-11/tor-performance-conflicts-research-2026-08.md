# Investigation — Tor performance / conflict research (external + Obscur)

**Status:** Evidence gathered · 2026-08-08  
**Trigger:** Maintainer: host stayed interactive until **manual Tor enable**, then **full lockup** (expected failure class).  
**Parents:** [tor-gateway-r4-design-2026-08.md](./tor-gateway-r4-design-2026-08.md) · [tor-enable-wedge-investigation-2026-08.md](./tor-enable-wedge-investigation-2026-08.md)

```text
CLAIM:     Research only — not Gateway Verified / not Tor opt-in Verified
FREEZE:    Tor preference ON → eventual host lockup still in scope
```

---

## Maintainer runtime note

| Observation | Interpretation |
|-------------|----------------|
| Initially no freeze | R4 Slice 1–2 subtraction (no in-process spawn / no boot SOCKS arm) helps **until** Tor is turned on |
| Full lockup after manual enable | Tor enable path still couples UI work to Tor/SOCKS load — **not** fixed by gateway lifecycle alone |

---

## External findings (Tor Project / community)

### 1. Parent process must drain Tor stdout — or Tor blocks

- **Source:** [Tor Browser #41549](https://gitlab.torproject.org/tpo/applications/tor-browser/-/issues/41549) — Tor freezes after many invalid hits on SocksPort when parent does not read stdout fast enough (pipe full → Tor blocked on log write).
- **Mitigation class:** Always consume stdout/stderr; lower log volume (`Log err stdout`); never block UI thread on Tor I/O.
- **Obscur:** Gateway *does* read lines; UI must not re-introduce sidecar log scraping on the paint/command path.

### 2. C Tor is a single-threaded async event loop

- **Source:** [tor-dev embedding thread](https://lists.torproject.org/mailman3/hyperkitty/list/tor-dev@lists.torproject.org/thread/YDJ4T4OFMFCJUUPXAUVEY2GTYL4YMTDM/) (Nick Mathewson): Tor is **not** multithreaded for SOCKS; one main event loop + limited crypto threads.
- **Implication:** Burst parallel SOCKS (many relays / HTTP / WS) queues on **one** daemon loop → latency spikes and apparent “freeze” of anything waiting on those dials.
- Matches Obscur historical **NativeRelay × parallel dials × SOCKS** storm.

### 3. Resource exhaustion under heavy connect load

- Tor tracks **FD / TCP port exhaustion** when sockets cannot be created ([tor-commits overload metrics](https://archive.torproject.org/websites/lists.torproject.org/pipermail/tor-commits/2021-March/217145.html)).
- Heavy concurrent use of SocksPort / TransPort has long been a design concern ([tor-talk heavy usage](https://archives.seul.org/tor/talk/Nov-2011/msg00288.html)).

### 4. SocksPort bind conflicts

- `Address already in use` on 9050/9150 when another Tor (or leftover instance) owns the port ([forum](https://forum.torproject.org/t/need-help-trying-to-use-tor-via-systemctl-but-it-not-working/16799), [StackExchange](https://tor.stackexchange.com/questions/21576/tor-service-failing-to-start-in-linux)).
- **Obscur false-READY class:** treating TCP-open or “address in use” as Connected is wrong; only `Bootstrapped 100%` (or Arti “sufficiently bootstrapped”) counts.

### 5. Multiple Expert Bundle clients / circuit churn

- Concurrent `tor.exe` + aggressive restart/IP rotation often sticks at **Bootstrapped 95% (circuit_create)** ([StackExchange](https://tor.stackexchange.com/questions/23021/running-2-clients-at-same-time-and-getting-stucked-at-95-circuit-create-establ)).
- Rapid `NewCircuitPeriod` / multi-instance fights the network and the local daemon.

### 6. C Tor was not designed for embedding; Arti is the successor

- **Amethyst / desktop:** C Tor via kmp-tor — segfaults, multi-app instance conflicts; migrate to **Arti** ([issue #2385](https://github.com/vitorpamplona/amethyst/issues/2385)).
- **Tor Project:** [Arti 1.0.0](https://blog.torproject.org/arti_100_released/) — production client use; embed-oriented APIs; **multithreaded by default** vs C Tor’s limited threading ([forum Q&A](https://forum.torproject.org/t/arti-1-0-0-is-released-our-rust-tor-implementation-is-ready-for-production-use/4446)).
- Arti proxy logs explicit: *“Sufficiently bootstrapped; system SOCKS now functional”* — cleaner ready signal than scraping C Tor notice lines.

### 7. Windows process weirdness

- Historic **unkillable `tor.exe`** after Tor Browser close ([#26887](https://archive.torproject.org/websites/lists.torproject.org/pipermail/tbb-bugs/2018-July/020757.html), [#27024](https://archives.seul.org/tor/bugs/Aug-2018/msg00150.html)).
- Obscur’s `taskkill /IM tor.exe /F /T` is a blunt hammer: can race with a live gateway child and stress the session; not a substitute for PID-tree ownership.

---

## Obscur coupling still live after R4 Slice 3

| Layer | Slice 3 state | Freeze risk |
|-------|---------------|-------------|
| UI `shell.sidecar("tor")` | Refused | Mitigated |
| `NativeNetworkRuntime` SOCKS | Forced `false` | Mitigated for NativeRelay |
| Gateway owns `tor.exe` | Intended | Lifecycle OK |
| `get_tor_status` → `ready: true` when gateway bootstraps | **Live** | Mesh `resolveConduitHttpTransportMode` switches to **socks** when `ready && proxyUrl` |
| Mesh `socksFetch` host port | Still in **UI/Tauri** process | **Parallel SOCKS dials return in-process** → same wedge class |

**Conclusion:** Separating **lifecycle** (gateway) without separating **dials** (Slice 4) is insufficient. Manual enable → gateway start → status `ready` → mesh SOCKS from UI ≈ inevitable lockup.

---

## Design implications (no code in this doc)

| Priority | Action |
|----------|--------|
| P0 | Until Slice 4: **do not advertise `ready` to mesh/UI dial paths** even if gateway bootstrap is 100%. Split “gateway lifecycle ready” vs “UI may open SOCKS”. → **Implemented (L1) 2026-08-08** |
| P0 | Slice 4: all Tor dials in gateway (or Arti worker); UI kill-switch stays clearnet when gateway times out. → **4a HTTP dials Implemented (L1) 2026-08-08**; WS/NativeRelay still clearnet (4b) |
| P1 | Cap concurrency (relay pool dial budget) even after dial move — C Tor single-loop still saturates. |
| P1 | Drain Tor logs in gateway only; never on UI command queue. |
| P2 | Evaluate **Arti** as gateway engine (embed/API ready signal) vs Expert Bundle `tor.exe`. |
| P2 | Stop global `taskkill` of all `tor.exe`; scope to gateway PID tree. |

---

## Proof language

| May say | When |
|---------|------|
| Research recorded | This file |
| Freeze class still open | Maintainer manual enable lockup 2026-08-08 |
| Gateway Verified | L3: Tor ON + UI interactive **with dials not in UI** |

**Forbidden:** Claiming R4 “fixed Tor” after Slice 3 alone.
