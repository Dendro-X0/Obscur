# R-ACCOUNT L3a evidence — parity P2 unlock (2026-07-30)

**Surface:** parity-desktop CDP `:9230` · session `csess-add9082b581f`  
**Design:** [r-account-slice5-design-2026-07.md](../../specs/backend/r-account-slice5-design-2026-07.md)

## Steps

1. Attached live WebView2 (stack preflight blocked `client_session_connect` without `skipStackPreflight` — used attach).  
2. Soft-lock → F5 → Welcome Back (`auth.kernel_boot_restore_manual_lock` in digest).  
3. Unlock Tester1 (`SyI14^ew1E`) via password field + `form button[type=submit]`.  
4. Shell: Chats · Tester1 · surface `shell`.

## Invokes (post-unlock)

```json
{
  "session": { "is_active": true, "is_native": true, "npub": "e07f67dc…c191ea56" },
  "boot": {
    "profileId": "default",
    "phase": "unlocked",
    "keychainPresent": true,
    "restoreEligible": true
  }
}
```

## Captures

| Kind | Path |
|------|------|
| Unlock submit | `.codectx/verify/client-sessions/csess-add9082b581f/captures/cap-94266217f78a/` |
| Digest | `.codectx/verify/client-sessions/csess-add9082b581f/captures/cap-dd16b525d203/digest.json` |
| Assert Tester1 | `cap-c62dd908af08` |

## Verdict

| Gate | Result |
|------|--------|
| L3a parity unlock → shell | **Pass** |
| P2 verified | **Not yet** — needs L3b release exe |
| Code | None — no failing owner |

**Note:** Relay offline banners are P3, out of Slice 5.
