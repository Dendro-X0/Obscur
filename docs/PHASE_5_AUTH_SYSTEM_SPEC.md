# Phase 5: Auth & Anti-Bot Architecture — Technical Specification

> **Parent Document:** [Project Context](PROJECT_CONTEXT.md)
> **Status:** Draft
> **Target:** V1 Identity & Authentication System overhaul

---

## 1. Executive Summary

Phase 5 focuses on transforming Obscur's authentication and registration system. We are deprecating traditional Web2 onboarding paradigms. The new system creates profiles that are as secure as cryptographic wallets—relying entirely on blockchain encryption principles—while providing a seamless, modern social app onboarding experience.

To ensure the integrity of the network, strict anti-bot registration measures will be implemented, making it computationally expensive or socially gated to create large volumes of automated accounts.

---

## 2. Core Pillars

1. **Self-Sovereign Cryptographic Identity**:
   - Accounts are strictly bound to a unified private key (`nsec`).
   - No email, no phone number, and no OAuth linkages.
   - **No Password Recovery**: If the private key is lost, the account and its encrypted data are unrecoverable.

2. **Frictionless Web3 Onboarding**:
   - The user experience must mirror top-tier modern social apps (smooth animations, simple concepts).
   - Key storage happens transparently in hardware-backed enclaves (Secure Enclave / Android Keystore) upon creation.

3. **Anti-Bot Defenses (Sybil Resistance)**:
   - Implementing structural barriers to prevent automated server-farm account generation that plague traditional open networks.

---

## 3. Anti-Bot Registration Mechanisms

To stop bots from flooding the network, new account creation must carry a "cost". We will implement a multi-layered defense:

### A. Proof of Work (PoW) - NIP-13 / Hashcash
New identities will be required to mine a mathematically complex "Proof of Work" ticket before they can broadcast their initial profile creation event to relays.
- **Mechanism:** The client must find a cryptographic hash containing a target number of leading zeros.
- **UX Impact:** A few seconds of "Generating Identity Security..." loading screen on modern devices, but prohibitive for server farms trying to mint millions of keys.

### B. Invite-Only / Web of Trust Gating (Optional Overlay)
- Users may require an cryptographic invite token (issued by an existing network member) to bypass heavy PoW or strict relay constraints.

---

## 4. Authentication Flow

### Account Creation
1. User taps "Create Identity".
2. Application locally generates a high-entropy secp256k1 keypair.
3. A background WebWorker performs the Proof-of-Work algorithm.
4. The private key is injected into the OS Secure Keystore, and the user is prompted for Biometric access (Face ID/Fingerprint).
5. User selects an avatar and display name (published as a signed metadata event).

### Logging In (Restoring)
1. User taps "I already have an identity" or "Log In with Key".
2. User provides their private key string (`nsec`).
3. App validates the key format instantly.
4. Key is migrated into the Secure Keystore.
5. App rebuilds the local state by syncing historical events from the network.

---

## 5. Security & Recovery Philosophy

- **Absolute Ownership:** The platform database holds zero knowledge of the user's secrets.
- **Warning Prompts:** Users must be explicitly, but elegantly, warned during onboarding that their recovery key (the `nsec`) is the *only* way to restore their account if they lose their device.
- **Backup Exports:** The settings panel will feature a highly visible "Export Identity" function, prompting the user to safely write down or digitally vault their key.

---

## 6. Implementation Roadmap

- **WP-1: Core Proof of Work Engine**: Implement an optimized WASM or Rust-backed PoW miner for the client to execute during registration.
- **WP-2: UI/UX Overhaul for Key Generation**: Build the interactive "Mining Profile" screen and integrate WebAuthn / Biometrics for the generated key.
- **WP-3: Registration Relay Gateway**: Configure standard App Relays to instantly reject profile creation events (`kind: 0`) that do not meet the minimum PoW difficulty threshold.
- **WP-4: Security Warnings & Export Flow**: Implement the dedicated UI for highlighting the "No Password Recovery" nature of the system.
