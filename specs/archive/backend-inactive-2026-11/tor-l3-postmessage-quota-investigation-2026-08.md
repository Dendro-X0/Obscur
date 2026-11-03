# Investigation — L3 soak: PostMessage quota / illegal instruction

**Status:** Root cause class identified · Fix slice applied (emit-on-change) · 2026-08-08  
**Evidence:** Desktop terminal after Tor enable (Slice 4a tree)

```text
PostMessage failed ; is the messages queue full? Error code 0x80070718
…
[NativeRelay] Tor enabled=false
[NativeRelay] connect_relay url=wss://…
error: … STATUS_ILLEGAL_INSTRUCTION (0xc000001d)
```

## Verdict

| Claim | Result |
|-------|--------|
| Tor SOCKS armed in UI | **No** — log shows `Tor enabled=false` |
| Host freeze class | **Yes** — UI IPC / message queue exhaustion → crash |
| Gateway Verified | **Fail** (L3) |

## Causal chain (Obscur)

1. `get_tor_status` called often (Settings listener, mesh host refresh, polls).
2. Each call `emit("tor-status", …)` even when state unchanged.
3. JS `tor-status` listener immediately `invoke("get_tor_status")` again → **feedback loop**.
4. Parallel clearnet `connect_relay` storms also PostMessage IPC results into the same WebView queue.
5. Windows returns `0x80070718` (ERROR_NOT_ENOUGH_QUOTA) / “messages queue full”.
6. wry/Tauri path historically panics or hard-fails → process exits `STATUS_ILLEGAL_INSTRUCTION` (known Tauri/WebView2 class: [tauri#10546](https://github.com/tauri-apps/tauri/issues/10546), [tauri#8207](https://github.com/tauri-apps/tauri/issues/8207)).

## External class

Flooding WebView2 via `Emitter::emit` / async command completions while the UI thread cannot drain the queue → PostMessage failure spam → process death. Not unique to Tor; Tor enable amplifies polling/listeners.

## Fix (this iteration)

| Change | Why |
|--------|-----|
| `set_tor_runtime_status` emits **only on change** | Stop identical-status spam |
| `get_tor_status` **does not emit** | Poll is pull; push only on real transitions |
| TS listener: refresh snapshot without relying on emit loop | Safe once Rust stops re-emitting |

## Still open

| Item | Notes |
|------|-------|
| NativeRelay parallel connect storm | Clearnet dial burst still visible in log — separate cap later |
| Slice 4b WS via gateway | Not in this fix |
| L3 re-soak | Required before Gateway Verified |

**Forbidden:** Claiming Tor freeze fixed from L1 alone; flipping UI SOCKS.
