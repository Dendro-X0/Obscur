# Security Protocols & Decentralized Architecture

Obscur is more than just a chat application; it is a reference implementation of a **secure, decentralized, and censorship-resistant communication layer**. The technologies and protocols developed here are designed to be modular and reusable for any application requiring high-security standards, such as healthcare, finance, or confidential enterprise communications.

## 🔐 Core Security Technologies

### 1. End-to-End Encryption (E2EE)
Obscur guarantees that only the sender and the intended recipient can read messages. Relays (servers) only transport encrypted blobs and never have access to cleartext data.

- **Algorithm**: We use **NIP-44 (Version 2)**, which employs **XChaCha20-Poly1305** for authenticated encryption.
- **Key Exchange**: Shared secrets are derived using **secp256k1** Elliptic Curve Diffie-Hellman (ECDH).
- **Forward Secrecy**: (Future Roadmap) Implementation of ratchet mechanisms (Double Ratchet) for perfect forward secrecy.

### 2. Metadata Privacy (NIP-17)
Standard E2EE protects message *content* but often leaks *metadata* (who is talking to whom). Obscur implements **NIP-17 Private Direct Messages** to solve this.

- **Triple Wrapping**:
    1.  **Rumor**: The actual message payload (encrypted).
    2.  **Seal**: Ensures the sender's identity is authenticated but hidden from outsiders.
    3.  **Gift Wrap**: The final envelope addressed to the recipient, making the package look like random noise to anyone else.
- **Outcome**: Even the relay servers cannot determine who is communicating with whom.

### 3. Decentralized Identity (DID)
Users are identified by cryptographic keys, not by entries in a central database.

- **Public Key as ID**: Your **npub** (Nostr Public Key) is your universal username.
- **Portability**: You can move your identity and data to any other client or relay. No vendor lock-in.
- **Censorship Resistance**: no central authority can ban or delete your account.

### 4. Local-First Data Ownership
Your data lives on your device, not in the cloud.

- **Storage**: Messages and contacts are stored in **IndexedDB** locally.
- **At-Rest Encryption**: The local database is encrypted using **AES-GCM** with a key derived from your passphrase (PBKDF2/Argon2).
- **Offline Capable**: The app functions fully offline; data syncs when a connection is available.

---

## 🧩 Reusable Modules

The core logic of Obscur is separated into independent packages within the `packages/` directory, allowing developers to reuse these robust security primitives in their own projects.

| Package | Description | Usecases |
| :--- | :--- | :--- |
| **`dweb-crypto`** | High-level wrappers for secp256k1, Schnorr signatures, and AES encryption. | Any app needing secure key management and signing. |
| **`dweb-nostr`** | Implementation of Nostr protocol primitives (events, filters, subs). | Building decentralized social, news, or marketplace apps. |
| **`dweb-storage`** | Encrypted-at-rest local storage abstraction over IndexedDB. | Offline-first apps requiring HIPPA/GDPR compliance data protection. |

## 🔮 Future Roadmap: The "Obscur Protocol"

Our vision extends beyond this messenger. We aim to formalize the **Obscur Protocol**—a set of standards for **confidential micro-communities**.

- **Group Ratchets**: Scalable E2EE for large groups without central servers (using MLS or similar).
- **Private Relay Networks**: Easy-to-deploy, ephemeral relay instances for temporary secure channels.
- **Zero-Knowledge Access**: Using ZK-proofs for community entry without revealing real-world identity.

---

*This document serves as a high-level overview of the security architecture. For implementation details, refer to the source code in `packages/`.*
