# Desktop File Upload Issues (Known Limitation)

**Status:** UNRESOLVED
**Version:** v0.5.2-alpha
**Date:** 2026-02-07

## Overview
The desktop application consistently fails to upload files, send attachments, or display uploaded images. This issue persists across multiple reinstallations and clear data attempts, suggesting a fundamental limitation in the current Tauri/WebView environment or a failure in the application update mechanism on specific systems.

## Symptoms
- **"Failed to fetch" Error**: Every attempt to upload an avatar or file results in this generic error.
- **Broken Images**: Images sent by others or even local previews fail to load.
- **Incomplete Feature Set**: The desktop app behaves as an "incomplete version," lacking core media capabilities that work perfectly in the web version.

## Root Causes Investigated
1.  **CORS Restrictions (WebView)**:
    - The Tauri WebView enforces strict Cross-Origin Resource Sharing (CORS) policies.
    - Native `fetch` requests from `tauri://localhost` to external NIP-96 servers (e.g., `nostr.build`) are consistently blocked.
    - **Attempted Fix**: Replaced native `fetch` with `@tauri-apps/plugin-http` and later `@tauri-apps/plugin-upload` to bypass WebView restrictions.

2.  **FormData Serialization**:
    - Sending a `File` object via `FormData` from JavaScript to Rust (Tauri backend) often fails serialization. The file content is lost or corrupted in transit.
    - **Attempted Fix**: 
        - Using `plugin-http`'s fetch implementation (failed due to body parsing issues).
        - Using `plugin-upload` with `File` object directly (failed due to type mismatch - expects string path).
        - Writing file to temp directory first, then uploading path (implemented in v0.5.2-alpha but reported as failed/unsolvable by user).

3.  **Environment/State Persistence**:
    - User reports that reinstalling and clearing data does not resolve the "incomplete version" state.
    - This suggests either:
        - The updater is failing to replace critical binaries.
        - Deep system-level caching (WebView/Edge) is persisting broken state.
        - Antivirus/Firewall software is blocking the Tauri backend's external network requests entirely.

## Current State & Workaround
- **Desktop App**: File uploads are currently **unsupported** in this environment.
- **Workaround**: Use the Web Version (PWA) for all file upload needs. The web version handles `FormData` and CORS correctly within the browser context.

## Technical Details (For future debugging)
- **Plugin Stack**: `tauri-plugin-upload` v2, `tauri-plugin-fs` v2, `tauri-plugin-http` v2.
- **Permissions**: `fs:default` (temp write), `upload:default`, `http:default` (all enabled).
- **Failure Point**: The failure occurs at the network request level within the Rust backend, returning a generic error to the frontend.

---
**Note**: This document serves as a record of the issue. Further attempts to fix this in the current environment have been deemed unproductive.
