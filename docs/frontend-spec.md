# Frontend spec — Discovery clear history + reconnect honesty (2026-11-06)

## Surfaces

1. Discovery (`/search`) idle → **Recent Searches** header + **Clear history**
2. Network → Connection profile → Remove (behavior; chrome unchanged)

## Goals

- Clear recent searches in one control; wipe scoped + legacy `localStorage` keys.
- After Remove, peer is notified (`connection-cancel`) and local DM stub is deleted so Connect is a true stranger re-invite.

## Non-goals

- Redesigning Discovery layout
- Merging dual blocklist stores this cut

## Copy

- `search.clearRecent` → “Clear history”
