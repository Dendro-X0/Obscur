# UI — Protocols/Network settings panel

**Date (UTC):** 2026-10-17  
**Status:** Landed  
**Surface:** Settings → Network → Protocols/Network

## Problem

Nav label “Protocols” under group **NETWORK** hid Matrix next to Relays. Panel copy repeated “Nostr is the native path” (hint + switch summary + migration card). Matrix i18n still described password-only login.

## Decisions

1. Nav label → **Protocols/Network** (panel title stays **Protocols & network**).
2. Section order: **Protocol** → **Network path** → **Matrix homeserver** (credentials last; path is peer to protocol).
3. One short protocol hint; keep switch summary; keep migration card (drop duplicate hint wording).
4. Matrix hint + button labels match password **or** access-token paths.

## Non-goals

Relays merge · Soft L3 · Tor Verified · Olm

_Last updated: 2026-10-17T15:50:00Z_
