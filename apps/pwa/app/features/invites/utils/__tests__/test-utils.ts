import * as fc from 'fast-check';
import { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import {
  QRInviteOptions,
  InviteLinkOptions,
  Contact,
  ContactGroup,
  UserProfile,
  PrivacySettings,
  TrustLevel,
  ContactRequestStatus,
} from '../types';

/**
 * Generates a valid Nostr public key (64 character hex string)
 */
export const publicKeyArbitrary = fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 64, maxLength: 64 })
  .map(arr => arr.map(n => n.toString(16)).join(''));

/**
 * Generates a valid display name
 */
export const displayNameArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim() === s);

/**
 * Generates a valid avatar URL
 */
export const avatarUrlArbitrary = fc.webUrl();

/**
 * Generates a valid bio text
 */
export const bioArbitrary = fc.string({ maxLength: 200 });

/**
 * Generates a valid contact message
 */
export const messageArbitrary = fc.string({ maxLength: 500 });

/**
 * Generates a trust level
 */
export const trustLevelArbitrary = fc.constantFrom<TrustLevel>('trusted', 'neutral', 'blocked');

/**
 * Generates a contact request status
 */
export const contactRequestStatusArbitrary = fc.constantFrom<ContactRequestStatus>(
  'pending', 'accepted', 'declined', 'cancelled', 'expired'
);

/**
 * Generates QR invite options
 */
export const qrInviteOptionsArbitrary = fc.record({
  displayName: fc.option(displayNameArbitrary, { nil: undefined }),
  avatar: fc.option(avatarUrlArbitrary, { nil: undefined }),
  message: fc.option(messageArbitrary, { nil: undefined }),
  expirationHours: fc.option(fc.integer({ min: 1, max: 168 }), { nil: undefined }), // 1 hour to 1 week
  includeProfile: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * Generates invite link options
 */
export const inviteLinkOptionsArbitrary = fc.record({
  displayName: fc.option(displayNameArbitrary, { nil: undefined }),
  avatar: fc.option(avatarUrlArbitrary, { nil: undefined }),
  message: fc.option(messageArbitrary, { nil: undefined }),
  expirationTime: fc.option(fc.date({ min: new Date(), max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }), { nil: undefined }),
  maxUses: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  includeProfile: fc.option(fc.boolean(), { nil: undefined }),
});

/**
 * Generates a contact
 */
export const contactArbitrary = fc.record({
  id: fc.uuid(),
  publicKey: publicKeyArbitrary as fc.Arbitrary<PublicKeyHex>,
  displayName: displayNameArbitrary,
  avatar: fc.option(avatarUrlArbitrary, { nil: undefined }),
  bio: fc.option(bioArbitrary, { nil: undefined }),
  trustLevel: trustLevelArbitrary,
  groups: fc.array(fc.uuid(), { maxLength: 5 }),
  addedAt: fc.date({ max: new Date() }),
  lastSeen: fc.option(fc.date({ max: new Date() }), { nil: undefined }),
  metadata: fc.record({
    source: fc.constantFrom('qr', 'link', 'import', 'manual'),
    importedFrom: fc.option(fc.string(), { nil: undefined }),
    notes: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  }),
});

/**
 * Generates a contact group
 */
export const contactGroupArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  color: fc.option(fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 6, maxLength: 6 })
    .map(arr => `#${arr.map(n => n.toString(16)).join('')}`), { nil: undefined }),
  createdAt: fc.date({ max: new Date() }),
});

/**
 * Generates a user profile
 */
export const userProfileArbitrary = fc.record({
  displayName: displayNameArbitrary,
  avatar: fc.option(avatarUrlArbitrary, { nil: undefined }),
  bio: fc.option(bioArbitrary, { nil: undefined }),
  website: fc.option(fc.webUrl(), { nil: undefined }),
  nip05: fc.option(fc.emailAddress(), { nil: undefined }),
  lud16: fc.option(fc.emailAddress(), { nil: undefined }),
});

/**
 * Generates privacy settings
 */
export const privacySettingsArbitrary = fc.record({
  shareDisplayName: fc.boolean(),
  shareAvatar: fc.boolean(),
  shareBio: fc.boolean(),
  shareWebsite: fc.boolean(),
  allowContactRequests: fc.boolean(),
  requireMessage: fc.boolean(),
  autoAcceptTrusted: fc.boolean(),
});

/**
 * Generates a timestamp in the future (for expiration testing)
 */
export const futureTimestampArbitrary = fc.integer({
  min: Date.now() + 1000,
  max: Date.now() + 7 * 24 * 60 * 60 * 1000
});

/**
 * Generates a timestamp in the past (for expiration testing)
 */
export const pastTimestampArbitrary = fc.integer({
  min: Date.now() - 7 * 24 * 60 * 60 * 1000,
  max: Date.now() - 1000
});

/**
 * Property test configuration with standard settings
 */
export const propertyTestConfig = {
  numRuns: 20, // Reduced for faster execution
  timeout: 5000,
  verbose: true,
};