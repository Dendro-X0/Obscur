# Debugging Status Report: Release v0.6.7-alpha

**Date**: 2026-02-08
**Status**: ❌ Unresolved (Upload 401, Relay 502)

This report documents the current state of the application after the Phase 3 fixes were applied. Despite these changes, the application is experiencing critical errors during file uploads and relay connections.

## 1. Observed Errors

### A. File Upload Failure (NIP-96)
- **Error Code**: `HTTP 401 Unauthorized`
- **Error Message**: `{"status":"error","message":"Unauthorized, please provide a valid nip-98 token","data":{}}`
- **Context**: Attempting to upload a file (e.g., avatar) using the native desktop app.
- **Provider**: Likely `nostr.build` (default configuration).

### B. Relay Connection Failure
- **Error Code**: `HTTP 502 Bad Gateway`
- **Error Message**: `Failed to connect to wss://relay.nostr.band: HTTP error: 502 Bad Gateway`
- **Context**: Occurs repeatedly on application startup or when attempting to connect to the relay pool.
- **Impact**: App cannot fetch messages or publish events.

---

## 2. Changes Implemented (v0.6.7-alpha)

To address the authentication issues, the following changes were made in Phase 3:

### Frontend (`nip96-upload-service.ts`)
1.  **SHA-256 Payload Hashing**: Added a `payload` tag to the NIP-98 authentication event, containing the SHA-256 hash of the file content.
2.  **Expiration Tag**: Added an `expiration` tag (set to 60 seconds from creation) to the NIP-98 event to prevent replay attacks.
3.  **Method Tag**: ensured `method` tag explicitly matches "POST".
4.  **Logging**: Added `console.info` logs when generating the auth event.

### Backend (`upload.rs`)
1.  **Detailed Logging**: Added `println!` statements to log:
    - Presence and length of the `Authorization` header.
    - Full request URL.
    - HTTP status code and full response body on failure.

---

## 3. Potential Root Causes & Hypotheses

### Upload Failure (401 Unauthorized)
1.  **Clock Skew**: The server may differ significantly from the client's system time. If the `created_at` timestamp in the auth event is outside the server's window (often +/- 60s), the token is invalid.
    - *Action*: Suggest user check system time or implement server time offset.
2.  **URL Mismatch**: The `u` tag in the auth event must *exactly* match the request URL. If `nostr.build` redirects (e.g., http -> https, or adds/removes trailing slash), the signature validation fails.
    - *Investigation*: Check network logs for redirects.
3.  **Payload Mismatch**: The SHA-256 hash might be calculated incorrectly or differently than expected by the server (e.g., encoding issues).
4.  **Header Stripping**: The `Authorization` header might be stripped by a proxy or firewall before reaching the server.

### Relay Failure (502 Bad Gateway)
1.  **Upstream Server Down**: `relay.nostr.band` might be experiencing downtime.
2.  **Network/Proxy Issue**: If Tor or a proxy is enabled, the 502 might be coming from the local proxy, not the remote server.
3.  **WSS/TLS Issue**: SSL handshake failure or certificate issue might manifest as a connection error.

## 4. Recommendations for Next Steps

1.  **Verify System Time**: Ensure the client device's clock is synchronized.
2.  **Check URLs**: Use `curl` or Postman to verify the exact upload endpoint URL and if redirects occur.
3.  ** inspect Logs**: Run the app from a terminal to see the `println!` output from `upload.rs`. This will show the exact URL and headers being sent.
    ```bash
    # Run from terminal
    ./Obscur.exe
    ```
4.  **Isolate Relay Issue**: Try connecting to a different relay (e.g., `wss://relay.damus.io`) to see if the 502 is specific to `nostr.build` or a general network issue.
