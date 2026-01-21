# Requirements Document

## Introduction

This specification defines the requirements for implementing reliable message delivery in Obscur, a local-first Nostr messenger. The current implementation has the UI and basic infrastructure but lacks functional message delivery through the Nostr relay network. This feature will enable users to send and receive encrypted direct messages reliably across the decentralized Nostr protocol.

## Glossary

- **DM_Controller**: The component responsible for managing direct message operations
- **Relay_Pool**: The connection manager for multiple Nostr relay WebSocket connections
- **Message_Queue**: Local storage system for pending and delivered messages
- **NIP-04**: Nostr Improvement Proposal for encrypted direct messages
- **Relay**: A Nostr server that stores and forwards messages
- **Event**: A Nostr protocol message containing user data
- **Pubkey**: A user's public key identifier in the Nostr network
- **Privkey**: A user's private key used for signing and decryption

## Requirements

### Requirement 1: Message Sending

**User Story:** As a user, I want to send encrypted direct messages to other users, so that I can communicate privately and securely.

#### Acceptance Criteria

1. WHEN a user types a message and clicks send, THE DM_Controller SHALL encrypt the message using NIP-04 encryption
2. WHEN the message is encrypted, THE DM_Controller SHALL create a Nostr event with the encrypted content
3. WHEN the event is created, THE DM_Controller SHALL sign the event with the user's private key
4. WHEN the event is signed, THE DM_Controller SHALL publish the event to all connected relays
5. WHEN publishing to relays, THE DM_Controller SHALL handle relay connection failures gracefully
6. WHEN a relay accepts the message, THE DM_Controller SHALL update the message status to "accepted"
7. WHEN a relay rejects the message, THE DM_Controller SHALL update the message status to "rejected"
8. WHEN all relays fail, THE DM_Controller SHALL queue the message for retry

### Requirement 2: Message Receiving

**User Story:** As a user, I want to receive encrypted direct messages from other users, so that I can see incoming communications in real-time.

#### Acceptance Criteria

1. WHEN connected to relays, THE DM_Controller SHALL subscribe to direct message events for the user's pubkey
2. WHEN a new DM event is received, THE DM_Controller SHALL verify the event signature
3. WHEN the signature is valid, THE DM_Controller SHALL decrypt the message content using NIP-04
4. WHEN decryption succeeds, THE DM_Controller SHALL add the message to the local message store
5. WHEN decryption fails, THE DM_Controller SHALL log the error and ignore the message
6. WHEN a message is added to the store, THE DM_Controller SHALL trigger UI updates
7. WHEN the sender is blocked, THE DM_Controller SHALL not display the message
8. WHEN the sender is unknown, THE DM_Controller SHALL route the message to the requests inbox

### Requirement 3: Message Persistence

**User Story:** As a user, I want my messages to be saved locally, so that I can see my conversation history when I restart the app.

#### Acceptance Criteria

1. WHEN a message is sent or received, THE Message_Queue SHALL persist it to local storage immediately
2. WHEN the app starts, THE Message_Queue SHALL load existing messages from local storage
3. WHEN storage is full, THE Message_Queue SHALL remove oldest messages beyond the configured limit
4. WHEN a message is deleted by the user, THE Message_Queue SHALL mark it as deleted but preserve the record
5. THE Message_Queue SHALL encrypt sensitive message data at rest using the user's key
6. THE Message_Queue SHALL maintain message ordering by timestamp
7. THE Message_Queue SHALL handle storage errors gracefully without data loss

### Requirement 4: Relay Connection Management

**User Story:** As a user, I want reliable connections to Nostr relays, so that my messages are delivered even when some relays are unavailable.

#### Acceptance Criteria

1. WHEN the app starts, THE Relay_Pool SHALL connect to all enabled relays from the user's relay list
2. WHEN a relay connection fails, THE Relay_Pool SHALL attempt to reconnect with exponential backoff
3. WHEN a relay is unreachable, THE Relay_Pool SHALL mark it as offline and continue with other relays
4. WHEN all relays are offline, THE Relay_Pool SHALL queue messages and retry connections
5. WHEN a relay comes back online, THE Relay_Pool SHALL sync any missed messages
6. THE Relay_Pool SHALL maintain connection status for each relay
7. THE Relay_Pool SHALL provide connection health metrics to the UI
8. WHEN relay performance is poor, THE Relay_Pool SHALL deprioritize that relay

### Requirement 5: Message Status Tracking

**User Story:** As a user, I want to see the delivery status of my messages, so that I know whether they were sent successfully.

#### Acceptance Criteria

1. WHEN a message is created, THE DM_Controller SHALL set the initial status to "sending"
2. WHEN a message is queued for retry, THE DM_Controller SHALL maintain the "sending" status
3. WHEN at least one relay accepts the message, THE DM_Controller SHALL update status to "accepted"
4. WHEN all relays reject the message, THE DM_Controller SHALL update status to "rejected"
5. WHEN the recipient's relay confirms delivery, THE DM_Controller SHALL update status to "delivered"
6. THE DM_Controller SHALL display appropriate status icons in the UI
7. THE DM_Controller SHALL allow users to retry failed messages
8. THE DM_Controller SHALL provide detailed error information for debugging

### Requirement 6: Message Synchronization

**User Story:** As a user, I want to see messages I missed while offline, so that I don't lose any conversations.

#### Acceptance Criteria

1. WHEN the app comes online after being offline, THE DM_Controller SHALL request missed messages from relays
2. WHEN requesting missed messages, THE DM_Controller SHALL use the timestamp of the last received message
3. WHEN duplicate messages are received, THE DM_Controller SHALL deduplicate based on event ID
4. WHEN messages arrive out of order, THE DM_Controller SHALL sort them by timestamp
5. THE DM_Controller SHALL handle large message backlogs efficiently
6. THE DM_Controller SHALL provide sync progress indicators to the user
7. WHEN sync fails, THE DM_Controller SHALL retry with exponential backoff
8. THE DM_Controller SHALL limit sync requests to prevent relay overload

### Requirement 7: Error Handling and Recovery

**User Story:** As a user, I want the messaging system to handle errors gracefully, so that temporary issues don't break my communication.

#### Acceptance Criteria

1. WHEN network connectivity is lost, THE DM_Controller SHALL queue outgoing messages locally
2. WHEN connectivity is restored, THE DM_Controller SHALL automatically send queued messages
3. WHEN a relay returns an error, THE DM_Controller SHALL log the error and try other relays
4. WHEN encryption fails, THE DM_Controller SHALL show a clear error message to the user
5. WHEN decryption fails, THE DM_Controller SHALL handle the error without crashing
6. THE DM_Controller SHALL provide retry mechanisms for failed operations
7. THE DM_Controller SHALL implement circuit breakers for consistently failing relays
8. WHEN storage operations fail, THE DM_Controller SHALL attempt recovery and notify the user

### Requirement 8: Performance and Scalability

**User Story:** As a user, I want the messaging system to be fast and responsive, so that conversations feel natural and real-time.

#### Acceptance Criteria

1. WHEN sending a message, THE DM_Controller SHALL show it in the UI immediately (optimistic updates)
2. WHEN receiving messages, THE DM_Controller SHALL update the UI within 100ms of decryption
3. THE DM_Controller SHALL batch multiple message operations to improve performance
4. THE DM_Controller SHALL implement efficient message pagination for large conversations
5. THE DM_Controller SHALL limit memory usage by unloading old messages from active memory
6. THE DM_Controller SHALL use WebSocket connections efficiently to minimize battery drain
7. THE DM_Controller SHALL implement message compression for large payloads
8. WHEN handling many concurrent messages, THE DM_Controller SHALL maintain UI responsiveness

### Requirement 9: Security and Privacy

**User Story:** As a user, I want my messages to be secure and private, so that only the intended recipient can read them.

#### Acceptance Criteria

1. THE DM_Controller SHALL use NIP-04 encryption for all message content
2. THE DM_Controller SHALL never store private keys in plaintext
3. THE DM_Controller SHALL validate all incoming message signatures
4. THE DM_Controller SHALL reject messages with invalid or missing signatures
5. THE DM_Controller SHALL use secure random number generation for encryption keys
6. THE DM_Controller SHALL clear sensitive data from memory after use
7. THE DM_Controller SHALL prevent timing attacks during cryptographic operations
8. THE DM_Controller SHALL log security events without exposing sensitive information