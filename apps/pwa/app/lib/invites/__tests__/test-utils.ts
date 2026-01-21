import * as fc from 'fast-check';
import { PublicKeyHex } from '@dweb/crypto';
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
  displayName: fc.option(displayNameArbitrary),
  avatar: fc.option(avatarUrlArbitrary),
  message: fc.option(messageArbitrary),
  expirationHours: fc.option(fc.integer({ min: 1, max: 168 })), // 1 hour to 1 week
  includeProfile: fc.option(fc.boolean()),
});

/**
 * Generates invite link options
 */
export const inviteLinkOptionsArbitrary = fc.record({
  displayName: fc.option(displayNameArbitrary),
  avatar: fc.option(avatarUrlArbitrary),
  message: fc.option(messageArbitrary),
  expirationTime: fc.option(fc.date({ min: new Date(), max: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })),
  maxUses: fc.option(fc.integer({ min: 1, max: 100 })),
  includeProfile: fc.option(fc.boolean()),
});

/**
 * Generates a contact
 */
export const contactArbitrary = fc.record({
  id: fc.uuid(),
  publicKey: publicKeyArbitrary as fc.Arbitrary<PublicKeyHex>,
  displayName: displayNameArbitrary,
  avatar: fc.option(avatarUrlArbitrary),
  bio: fc.option(bioArbitrary),
  trustLevel: trustLevelArbitrary,
  groups: fc.array(fc.uuid(), { maxLength: 5 }),
  addedAt: fc.date({ max: new Date() }),
  lastSeen: fc.option(fc.date({ max: new Date() })),
  metadata: fc.record({
    source: fc.constantFrom('qr', 'link', 'import', 'manual'),
    importedFrom: fc.option(fc.string()),
    notes: fc.option(fc.string({ maxLength: 100 })),
  }),
});

/**
 * Generates a contact group
 */
export const contactGroupArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.option(fc.string({ maxLength: 100 })),
  color: fc.option(fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 6, maxLength: 6 })
    .map(arr => `#${arr.map(n => n.toString(16)).join('')}`)),
  createdAt: fc.date({ max: new Date() }),
});

/**
 * Generates a user profile
 */
export const userProfileArbitrary = fc.record({
  displayName: displayNameArbitrary,
  avatar: fc.option(avatarUrlArbitrary),
  bio: fc.option(bioArbitrary),
  website: fc.option(fc.webUrl()),
  nip05: fc.option(fc.emailAddress()),
  lud16: fc.option(fc.emailAddress()),
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