# Requirements Document

## Introduction

The Smart Invite System transforms how users connect on Obscur by providing multiple intuitive ways to add friends and start conversations. This system eliminates the friction of manually sharing and entering long public keys, making Obscur accessible to mainstream users while maintaining its privacy-first approach.

## Glossary

- **Invite_System**: The complete system for generating, sharing, and processing connection invitations
- **QR_Generator**: Component that creates QR codes containing connection information
- **Invite_Link**: Shareable URL that contains encrypted connection data
- **Contact_Request**: A pending connection invitation awaiting user approval
- **Connection_Profile**: Basic user information shared during the invitation process
- **Invite_Manager**: Service that handles invite creation, validation, and processing
- **Contact_Store**: Local storage system for managing contacts and their metadata
- **Trust_Level**: User-defined trust classification for contacts (trusted, neutral, blocked)

## Requirements

### Requirement 1: QR Code Generation and Scanning

**User Story:** As a user, I want to generate and scan QR codes to connect with nearby friends, so that I can easily add contacts without typing long public keys.

#### Acceptance Criteria

1. WHEN a user requests to generate a connection QR code, THE Invite_System SHALL create a QR code containing their public key and connection metadata
2. WHEN a user scans a valid connection QR code, THE Invite_System SHALL extract the connection information and initiate a contact request
3. WHEN a QR code is generated, THE Invite_System SHALL include an expiration timestamp to prevent stale connections
4. WHEN a QR code expires, THE Invite_System SHALL reject scan attempts and display an appropriate error message
5. WHEN generating a QR code, THE Invite_System SHALL include the user's display name and avatar if available
6. WHEN scanning fails due to invalid format, THE Invite_System SHALL provide clear error feedback to the user

### Requirement 2: Shareable Invite Links

**User Story:** As a user, I want to create and share invite links, so that I can connect with friends remotely without requiring physical proximity.

#### Acceptance Criteria

1. WHEN a user creates an invite link, THE Invite_System SHALL generate a unique, shareable URL containing encrypted connection data
2. WHEN someone clicks an invite link, THE Invite_System SHALL open the app and pre-populate the connection request
3. WHEN an invite link is created, THE Invite_System SHALL allow the user to set an expiration time (1 hour, 1 day, 1 week, never)
4. WHEN an invite link expires, THE Invite_System SHALL display an expiration message and prevent connection attempts
5. WHEN an invite link is accessed, THE Invite_System SHALL validate the link integrity and authenticity
6. WHEN sharing an invite link, THE Invite_System SHALL provide multiple sharing options (copy, message, email, social media)

### Requirement 3: Contact Request Management

**User Story:** As a user, I want to manage incoming and outgoing contact requests, so that I can control who I connect with and maintain my privacy.

#### Acceptance Criteria

1. WHEN receiving a contact request, THE Invite_System SHALL display the request with sender information in a dedicated inbox
2. WHEN a user accepts a contact request, THE Contact_Store SHALL add the contact and enable direct messaging
3. WHEN a user declines a contact request, THE Invite_System SHALL remove the request and optionally block future requests from that user
4. WHEN sending a contact request, THE Invite_System SHALL allow the user to include a personal message
5. WHEN a contact request is pending, THE Invite_System SHALL show the status and allow cancellation
6. WHEN contact requests exceed 50 pending items, THE Invite_System SHALL automatically remove the oldest unresponded requests

### Requirement 4: Contact Profile Information

**User Story:** As a user, I want to see basic profile information when receiving contact requests, so that I can make informed decisions about accepting connections.

#### Acceptance Criteria

1. WHEN displaying a contact request, THE Invite_System SHALL show the sender's display name, avatar, and public key preview
2. WHEN a user sets up their profile, THE Connection_Profile SHALL allow them to specify display name, avatar, and bio
3. WHEN sharing connection information, THE Invite_System SHALL only include profile data the user has explicitly made shareable
4. WHEN receiving a contact request, THE Invite_System SHALL display any included personal message from the sender
5. WHEN profile information is missing, THE Invite_System SHALL use the public key prefix as a fallback display name
6. WHEN updating profile information, THE Connection_Profile SHALL propagate changes to existing contacts

### Requirement 5: Contact Import and Discovery

**User Story:** As a user, I want to import contacts from other Nostr clients and discover mutual connections, so that I can quickly rebuild my social network.

#### Acceptance Criteria

1. WHEN a user imports contacts, THE Invite_System SHALL support standard Nostr contact list formats (NIP-02)
2. WHEN importing contacts, THE Invite_System SHALL validate each public key and display import results
3. WHEN contacts are imported, THE Contact_Store SHALL merge with existing contacts and avoid duplicates
4. WHEN discovering mutual connections, THE Invite_System SHALL suggest contacts based on shared connections (with privacy controls)
5. WHEN importing fails for some contacts, THE Invite_System SHALL provide detailed error information for each failure
6. WHEN contacts are imported, THE Invite_System SHALL allow bulk contact request sending with rate limiting

### Requirement 6: Contact Organization and Management

**User Story:** As a user, I want to organize my contacts into groups and set trust levels, so that I can manage my social network effectively.

#### Acceptance Criteria

1. WHEN managing contacts, THE Contact_Store SHALL allow users to create custom contact groups (family, work, friends)
2. WHEN organizing contacts, THE Contact_Store SHALL support adding contacts to multiple groups simultaneously
3. WHEN setting trust levels, THE Contact_Store SHALL allow users to mark contacts as trusted, neutral, or blocked
4. WHEN viewing contacts, THE Invite_System SHALL provide search and filtering by name, group, and trust level
5. WHEN contacts are blocked, THE Invite_System SHALL prevent all communication and hide the contact from lists
6. WHEN contact groups are deleted, THE Contact_Store SHALL preserve individual contact data and remove only group associations

### Requirement 7: Privacy and Security Controls

**User Story:** As a user, I want granular privacy controls for my connection information, so that I can share only what I'm comfortable with while maintaining security.

#### Acceptance Criteria

1. WHEN creating invites, THE Invite_System SHALL allow users to control what profile information is shared
2. WHEN generating QR codes or links, THE Invite_System SHALL use cryptographically secure random data for uniqueness
3. WHEN processing invites, THE Invite_System SHALL validate all cryptographic signatures and reject invalid requests
4. WHEN storing invite data, THE Invite_System SHALL encrypt sensitive information using the user's private key
5. WHEN invite links are compromised, THE Invite_System SHALL allow users to revoke active invites immediately
6. WHEN privacy settings change, THE Invite_System SHALL apply new settings to future invites without affecting existing connections

### Requirement 8: Cross-Platform Compatibility

**User Story:** As a user, I want invite links and QR codes to work across different devices and platforms, so that I can connect with friends regardless of their device choice.

#### Acceptance Criteria

1. WHEN generating invite content, THE Invite_System SHALL use standardized formats compatible with other Nostr clients
2. WHEN processing external invites, THE Invite_System SHALL handle invite formats from popular Nostr applications
3. WHEN sharing across platforms, THE Invite_System SHALL generate universal links that work on web, mobile, and desktop
4. WHEN the app is not installed, THE Invite_System SHALL provide fallback web interface for invite processing
5. WHEN handling deep links, THE Invite_System SHALL properly route users to the appropriate app sections
6. WHEN invite formats are incompatible, THE Invite_System SHALL provide clear guidance on manual connection methods

### Requirement 9: User Experience and Accessibility

**User Story:** As a user, I want the invite system to be intuitive and accessible, so that I can easily connect with others regardless of my technical expertise.

#### Acceptance Criteria

1. WHEN using the invite system, THE Invite_System SHALL provide clear visual feedback for all actions and states
2. WHEN errors occur, THE Invite_System SHALL display user-friendly error messages with suggested solutions
3. WHEN generating invites, THE Invite_System SHALL offer guided tutorials for first-time users
4. WHEN using assistive technologies, THE Invite_System SHALL provide proper accessibility labels and navigation
5. WHEN the interface loads, THE Invite_System SHALL display loading states and progress indicators for long operations
6. WHEN users need help, THE Invite_System SHALL provide contextual help and documentation links