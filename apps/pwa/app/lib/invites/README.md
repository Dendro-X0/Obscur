# Smart Invite System

This directory contains the core implementation of the Smart Invite System for Obscur, providing intuitive and secure methods for users to connect with each other through QR codes, shareable links, and contact management.

## Directory Structure

```
invites/
├── __tests__/              # Test files
│   ├── setup.test.ts       # Basic setup and utility tests
│   └── test-utils.ts       # Property-based testing utilities
├── constants.ts            # System constants and configuration
├── errors.ts              # Custom error classes
├── interfaces.ts          # Service interfaces and contracts
├── types.ts               # TypeScript type definitions
├── utils.ts               # Utility functions
├── index.ts               # Main export file
└── README.md              # This file
```

## Core Components

### Types (`types.ts`)
- **Contact**: User contact information and metadata
- **ContactRequest**: Pending connection invitations
- **QRInviteData**: QR code payload structure
- **InviteLink**: Shareable link data structure
- **UserProfile**: User profile information
- **PrivacySettings**: Privacy control configuration

### Interfaces (`interfaces.ts`)
- **InviteManager**: Central orchestrator for invite operations
- **QRGenerator**: QR code generation and scanning
- **ContactStore**: Contact data persistence and management
- **ProfileManager**: User profile and privacy management
- **InviteCryptoService**: Cryptographic operations for invites

### Error Handling (`errors.ts`)
Custom error classes for different failure scenarios:
- `QRCodeError`: QR code operation failures
- `InviteLinkError`: Invite link validation/processing errors
- `ContactError`: Contact management failures
- `CryptoError`: Cryptographic operation failures
- `StorageError`: Data persistence failures
- `ValidationError`: Input validation failures

### Utilities (`utils.ts`)
Common utility functions:
- Public key validation and formatting
- Input sanitization and validation
- Date/time formatting and expiration checking
- Random string generation
- Debouncing and delay utilities

### Constants (`constants.ts`)
System-wide configuration:
- Database and storage configuration
- QR code and invite link settings
- Contact request limits
- Error messages
- UI configuration (colors, timeouts)

## Testing

The system uses a dual testing approach:

### Unit Tests
- Specific examples and edge cases
- Error condition testing
- Integration point validation

### Property-Based Tests
- Uses `fast-check` library
- 100+ iterations per property test
- Comprehensive input coverage
- Tests universal properties across all inputs

### Test Utilities (`__tests__/test-utils.ts`)
Provides arbitraries (generators) for:
- Valid public keys and profiles
- Contact data and groups
- Invite options and configurations
- Privacy settings
- Timestamps and expiration data

## Usage

```typescript
import {
  InviteManager,
  QRGenerator,
  ContactStore,
  ProfileManager,
  Contact,
  QRInviteOptions,
  InviteLinkOptions
} from '@/lib/invites';

// Example: Generate a QR invite
const inviteManager: InviteManager = new InviteManagerImpl();
const qrInvite = await inviteManager.generateQRInvite({
  displayName: 'Alice',
  message: 'Let\'s connect!',
  expirationHours: 24,
  includeProfile: true
});
```

## Security Considerations

- All invite data is cryptographically signed
- Sensitive information is encrypted before storage
- Public keys are validated using Nostr standards
- Input sanitization prevents XSS attacks
- Rate limiting prevents abuse
- Expiration timestamps prevent stale invites

## Integration

This system integrates with:
- Existing Obscur messaging system
- IndexedDB for local storage
- Nostr relay network for contact requests
- Web Crypto API for cryptographic operations
- Camera API for QR code scanning (future implementation)

## Next Steps

The interfaces and types are now ready for implementation. The next tasks will implement:
1. Crypto service enhancements
2. QR code generation and scanning
3. Contact store persistence
4. Profile management
5. UI components
6. Integration with existing Obscur features