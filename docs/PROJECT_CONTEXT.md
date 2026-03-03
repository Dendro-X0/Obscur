# Project Context Overview

Welcome to the Obscur project documentation. Obscur is a local-first Nostr messenger designed for small, invite-only micro-communities, built with privacy, decentralization, and anti-censorship as core principles.

This repository uses a structured documentation approach to quickly establish context for new developers or AI agents.

## Documentation Index

1. **[Stack & Technologies](stack.md)**: Detailed overview of the tech stack (Frontend, Backend, Languages, Tools).
2. **[Architecture & File Tree](architecture.md)**: System architecture, key components, data flow, and the complete project directory structure.
3. **[Design Patterns & Workflows](DESIGN_PATTERNS.md)**: Core UI/UX design models, state management, Sealed Communities egalitarian architecture, and relationships between various file structures.
4. **[Features & Roadmap](features.md)**: Comprehensive list of implemented capabilities, recent updates (Alpha 0.7.x), and upcoming goals.
5. **[Developer Guide](DEVELOPER_GUIDE.md)**: Instructions covering local development, building, and running tests.
6. **[Security Protocols](SECURITY_PROTOCOLS.md)**: Detailed breakdown of the cryptographic implementations (NIP-04, NIP-17, NIP-98, etc.).
7. **[Multimedia Upload & Playback](MULTIMEDIA_UPLOAD_PLAYBACK.md)**: Investigation log for NIP-96 uploads and media playback reliability in Tauri/WebView.
8. **[Auth & Anti-Bot System (Phase 5)](PHASE_5_AUTH_SYSTEM_SPEC.md)**: Specification for V1 Identity onboarding, blockchain key authentication, and Sybil resistance.
9. **[Community System V2 Spec](COMMUNITY_V2_SPEC.md)**: Full protocol and architecture specification for canonical community identity, anti-ghost lifecycle rules, relay-scope containment, disband semantics, migration, and rollout gates.

## Core Philosophy
- **🔒 Privacy-First**: End-to-end encrypted messaging using established Nostr cryptographic standards.
- **🌐 Decentralized**: Relay-based architecture with no central point of failure.
- **👥 Invite-Only**: Purpose-built for high-trust micro-communities.
- **📱 Local-First**: Your data and cryptographic keys live purely on your device, leveraging native keychains and IndexedDB.
