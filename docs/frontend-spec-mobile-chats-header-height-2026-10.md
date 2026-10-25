# Frontend spec — Mobile Chats header height vs other tabs (2026-10)

## Problem

Chats list sits under AppShell “OBSCUR” header **and** `.mobile-dm-shell` applied `padding-top` (preview: 24px). Network/Vault/etc. do not use `.mobile-dm-shell`, so Chats had a taller gap between brand header and search chrome.

## Contract

| Surface | Top safe-area owner |
|---------|---------------------|
| Tab list (Chats under AppShell header) | AppShell sticky header only — `.mobile-dm-shell` **padding-top: 0** |
| DM thread (`hideHeader`) | `MobileDmThreadHeader` (incl. preview CSS var) |
| Other tabs | AppShell header (unchanged) |

## Out of scope

Restoring hamburger on Chats (`hideSidebar` stays true for inline list).
