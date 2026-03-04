# Glossary and Canonical Terms

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


Use these terms consistently across docs, code comments, and changelog entries.

## Product Terms

- **Connection**: person-to-person relationship (preferred over “contact”).
- **Conversation**: chat thread id used by message rendering/persistence.
- **Group/Community**: multi-member encrypted messaging scope.
- **Vault**: local media cache/index layer.

## Runtime Terms

- **PWA runtime**: Next.js web app under `apps/pwa`.
- **Desktop runtime**: Tauri host app under `apps/desktop`.
- **Native bridge**: PWA-side calls into Tauri/native APIs.

## Messaging Terms

- **Message bus**: in-app event fanout (`new_message`, `message_updated`, `message_deleted`).
- **Persistence flush**: batched write cycle to IndexedDB.
- **Live window**: active-view message subset kept for smooth scrolling.

## Performance Terms

- **`chatPerformanceV2`**: feature flag enabling Phase 1 batching/optimization paths.
- **High-load mode**: UI mode that reduces expensive gesture work.
- **p95 UI latency**: 95th percentile update latency tracked by performance monitor.

## Security/Protocol Terms

- **Relay scope**: expected relay URL context for event acceptance.
- **Community binding tag**: tag(s) proving event belongs to expected group scope.
- **NIP-96**: file upload protocol provider path.

## Terminology Rules

1. Prefer “Connection” over “Contact”.
2. Distinguish runtime (`pwa`, `desktop`) in bug reports.
3. Use exact flag names (`chatPerformanceV2`) in docs and issues.
