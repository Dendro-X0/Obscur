# Investigation — Tor start fails (gateway up · tor exit 1)

**Date (UTC):** 2026-08-08  
**Status:** Root cause confirmed · fix in T5-1 torrc  
**Evidence:** Maintainer Security UI · `curl` gateway status `detail: tor exited: exit code: 1` · manual `tor.exe -f torrc`

```text
HANDOFF: T5-3 ops (parallel) · this is Tor bootstrap regression (T5-1 torrc)
CANONICAL OWNER: apps/tor-gateway render_client_torrc
PROOF: tor.exe accepts torrc · POST /v1/tor/start → starting then bootstrap progress (not exit 1)
```

## Symptom

- Security: Tor ON · RUNTIME GATEWAY · REACHABILITY PENDING · BOOTSTRAP ERROR · Degraded  
- Log: `gateway start → starting ready=false`  
- Gateway HTTP healthy; `tor.exe` dies immediately

## Root cause

`render_client_torrc` emitted:

```text
SocksPort 9050
IsolateSOCKSAuth 1
```

Tor 0.4.8.14 rejects **`IsolateSOCKSAuth` as a top-level option** (`Unknown option 'IsolateSOCKSAuth'`). Correct form is a **SocksPort flag**:

```text
SocksPort 9050 IsolateSOCKSAuth
```

## Fix

Update `render_client_torrc` + unit test · re-start gateway / Tor preference.
