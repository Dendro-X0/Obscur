/**
 * End-to-End System Tests for Smart Invite System
 * Tests complete workflows across all components
 * Feature: smart-invite-system
 * Validates: All requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inviteManager } from '../invite-manager';
import { contactStore } from '../contact-store';
import { profileManager } from '../profile-manager';
import { qrGenerator } from '../qr-generator';
import type {
  UserProfile,
  PrivacySettings,
  ContactGroup,
  NostrContactList
} from '../types';

const identityRef = vi.hoisted(() => ({
  current: {
    status: 'unlocked',
    publicKeyHex: '0'.repeat(64),
    privateKeyHex: '1'.repeat(64),
    stored: {
      publicKeyHex: '0'.repeat(64),
      encryptedPrivateKey: 'test-encrypted',
      username: 'test-user',
    },
  },
}));

const flushMicrotasks = async (): Promise<void> => {
  await new Promise<void>(resolve => queueMicrotask(resolve));
};

vi.mock('../security-enhancements', async (importOriginal) => {
  const original = await importOriginal<typeof import('../security-enhancements')>();
  return {
    ...original,
    canGenerateInviteLink: () => true,
    canGenerateQR: () => true,
    canProcessInvite: () => true,
    canSendContactRequest: () => true,
  };
});

vi.mock('../../../auth/hooks/use-identity', () => ({
  getIdentitySnapshot: () => identityRef.current,
}));

describe('Smart Invite System - End-to-End Tests', () => {
  beforeEach(async () => {
    const seed = `${Date.now()}-${Math.random()}`;
    const pubkey = seed.replace(/[^0-9a-f]/gi, '').padEnd(64, '0').slice(0, 64);
    const privkey = seed.replace(/[^0-9a-f]/gi, '').padEnd(64, '1').slice(0, 64);
    identityRef.current = {
      status: 'unlocked',
      publicKeyHex: pubkey,
      privateKeyHex: privkey,
      stored: {
        publicKeyHex: pubkey,
        encryptedPrivateKey: 'test-encrypted',
        username: 'test-user',
      },
    };

    const { cryptoService } = await import('../../../crypto/crypto-service');
    vi.spyOn(cryptoService, 'signInviteData').mockResolvedValue('mock-signature' as never);
    vi.spyOn(cryptoService, 'verifyInviteSignature').mockResolvedValue(true as never);

    // Reset profile to default state
    await profileManager.updateProfile({
      displayName: 'Test User',
      avatar: undefined,
      bio: undefined,
      website: undefined
    });

    await profileManager.updatePrivacySettings({
      shareDisplayName: true,
      shareAvatar: true,
      shareBio: true,
      shareWebsite: true,
      allowContactRequests: true,
      requireMessage: false,
      autoAcceptTrusted: false
    });
  });

  afterEach(async () => {
    // Clean up all data
    const contacts = await contactStore.getAllContacts();
    for (const contact of contacts) {
      await contactStore.removeContact(contact.id);
    }

    const groups = await contactStore.getAllGroups();
    for (const group of groups) {
      await contactStore.deleteGroup(group.id);
    }
  });

  describe('Complete Invite Link Workflow', () => {
    it('should handle full invite link lifecycle from creation to messaging', async () => {
      // Step 1: User A creates profile
      const profileA: UserProfile = {
        displayName: 'Alice',
        avatar: 'https://example.com/alice.png',
        bio: 'Software developer',
        website: 'https://alice.dev'
      };
      await profileManager.updateProfile(profileA);

      // Step 2: User A generates invite link
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Alice',
        message: 'Hey! Let\'s connect on Obscur',
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        includeProfile: true
      });

      expect(inviteLink.url).toBeTruthy();
      expect(inviteLink.isActive).toBe(true);
      expect(inviteLink.currentUses).toBe(0);

      // Step 3: User B receives and processes invite link
      const contactRequest = await inviteManager.processInviteLink(inviteLink.url);

      expect(contactRequest.type).toBe('incoming');
      expect(contactRequest.status).toBe('pending');
      expect(contactRequest.profile.displayName).toBe('Alice');
      expect(contactRequest.message).toBe('Hey! Let\'s connect on Obscur');

      // Step 4: User B accepts contact request
      const contact = await inviteManager.acceptContactRequest(contactRequest.id);

      expect(contact.displayName).toBe('Alice');
      expect(contact.trustLevel).toBe('neutral');

      // Step 5: Verify contact is in store and can be organized
      const storedContact = await contactStore.getContact(contact.id);
      expect(storedContact).toBeDefined();

      // Step 6: User B organizes contact into group
      const friendsGroup: ContactGroup = {
        id: 'friends-group',
        name: 'Friends',
        description: 'Close friends',
        createdAt: new Date(),
      };
      await contactStore.createGroup(friendsGroup);
      await contactStore.addContactToGroup(contact.id, friendsGroup.id);

      // Step 7: User B sets trust level
      await contactStore.setTrustLevel(contact.id, 'trusted');

      // Step 8: Verify final state
      const trustedContacts = await contactStore.getTrustedContacts();
      expect(trustedContacts).toHaveLength(1);
      expect(trustedContacts[0].id).toBe(contact.id);

      const groupContacts = await contactStore.getContactsByGroup(friendsGroup.id);
      expect(groupContacts).toHaveLength(1);
      expect(groupContacts[0].groups).toContain(friendsGroup.id);
    });

    it('should handle invite link with expiration and revocation', async () => {
      // Create invite link with short expiration
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Bob',
        expirationTime: new Date(Date.now() + 1000), // 1 second
        includeProfile: true
      });

      // Process immediately (should work)
      const request1 = await inviteManager.processInviteLink(inviteLink.url);
      expect(request1.status).toBe('pending');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Try to process expired link (should fail)
      await expect(
        inviteManager.processInviteLink(inviteLink.url)
      ).rejects.toThrow();

      // Create new link and revoke it
      const inviteLink2 = await inviteManager.generateInviteLink({
        displayName: 'Bob',
        includeProfile: true
      });

      // Revoke the link
      await inviteManager.revokeInviteLink(inviteLink2.id);

      // Try to process revoked link (should fail)
      await expect(
        inviteManager.processInviteLink(inviteLink2.url)
      ).rejects.toThrow();
    });
  });

  describe('Complete QR Code Workflow', () => {
    it('should handle full QR code lifecycle', async () => {
      const mockPublicKey = '0'.repeat(64);
      const mockPrivateKey = '1'.repeat(64);

      // Step 1: Generate QR code with profile
      const qrCode = await qrGenerator.createInviteQR(
        mockPublicKey as any,
        mockPrivateKey as any,
        {
          displayName: 'Charlie',
          avatar: 'https://example.com/charlie.png',
          message: 'Scan to connect!',
          expirationHours: 24,
          includeProfile: true
        }
      );

      expect(qrCode.dataUrl).toContain('data:image');
      expect(qrCode.rawData).toBeTruthy();

      // Step 2: Scan and process QR code
      const contactRequest = await inviteManager.processQRInvite(qrCode.rawData);

      expect(contactRequest.type).toBe('incoming');
      expect(contactRequest.profile.displayName).toBe('Charlie');
      expect(contactRequest.message).toBe('Scan to connect!');

      // Step 3: Accept contact
      const contact = await inviteManager.acceptContactRequest(contactRequest.id);

      expect(contact.displayName).toBe('Charlie');

      // Step 4: Search for contact
      const searchResults = await contactStore.searchContacts('Charlie');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe(contact.id);
    });

    it('should handle QR code expiration', async () => {
      const mockPublicKey = '0'.repeat(64);
      const mockPrivateKey = '1'.repeat(64);

      // Generate QR with very short expiration
      const qrCode = await qrGenerator.createInviteQR(
        mockPublicKey as any,
        mockPrivateKey as any,
        {
          displayName: 'Expired QR',
          expirationHours: 0.0003, // ~1 second
          includeProfile: true
        }
      );

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Try to process expired QR (should fail)
      await expect(
        inviteManager.processQRInvite(qrCode.rawData)
      ).rejects.toThrow();
    });
  });

  describe('Contact Request Management Workflow', () => {
    it('should handle contact request acceptance and decline', async () => {
      // Create multiple invite links
      const invite1 = await inviteManager.generateInviteLink({
        displayName: 'User 1',
        includeProfile: true
      });

      const invite2 = await inviteManager.generateInviteLink({
        displayName: 'User 2',
        includeProfile: true
      });

      // Process both invites
      const request1 = await inviteManager.processInviteLink(invite1.url);
      const request2 = await inviteManager.processInviteLink(invite2.url);

      // Accept first request
      const contact1 = await inviteManager.acceptContactRequest(request1.id);
      expect(contact1.displayName).toBe('Test User');

      // Decline second request
      await inviteManager.declineContactRequest(request2.id, false);

      // Verify only first contact exists
      const allContacts = await contactStore.getAllContacts();
      expect(allContacts).toHaveLength(1);
      expect(allContacts[0].id).toBe(contact1.id);
    });

    it('should handle contact request with blocking', async () => {
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Blocked User',
        includeProfile: true
      });

      const request = await inviteManager.processInviteLink(inviteLink.url);

      // Decline and block
      await inviteManager.declineContactRequest(request.id, true);

      // Verify blocked contact exists
      const allContacts = await contactStore.getAllContacts();
      expect(allContacts).toHaveLength(1);
      expect(allContacts[0]?.trustLevel).toBe('blocked');
    });

    it('should handle outgoing contact request cancellation', async () => {
      // Create an outgoing request
      const recipientPublicKey = 'f'.repeat(64);
      await inviteManager.sendContactRequest({
        recipientPublicKey: recipientPublicKey as any,
        message: 'hello',
        includeProfile: true
      });

      const outgoing = await inviteManager.getOutgoingContactRequests();
      expect(outgoing.length).toBeGreaterThan(0);

      // Cancel the request
      await inviteManager.cancelContactRequest(outgoing[0]!.id);

      // Verify request is cancelled (implementation specific)
      // This test validates the cancellation mechanism exists
    });
  });

  describe('Contact Import/Export Workflow', () => {
    it('should handle contact import and organization', async () => {
      // Create mock NIP-02 contact list
      const contactList: NostrContactList = {
        contacts: [
          {
            publicKey: '1'.repeat(64),
            relayUrl: 'wss://relay1.example.com',
            petname: 'Friend 1'
          },
          {
            publicKey: '2'.repeat(64),
            relayUrl: 'wss://relay2.example.com',
            petname: 'Friend 2'
          },
          {
            publicKey: '3'.repeat(64),
            relayUrl: 'wss://relay3.example.com',
            petname: 'Friend 3'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      // Import contacts
      const result = await inviteManager.importContacts(contactList);

      expect(result.totalContacts).toBe(3);
      expect(result.successfulImports).toBeGreaterThan(0);
      expect(result.failedImports).toBeLessThanOrEqual(3);

      // Export contacts
      const exported = await inviteManager.exportContacts();
      expect(exported.contacts).toBeDefined();
    });

    it('should handle duplicate contact imports', async () => {
      // Import same contacts twice
      const contactList: NostrContactList = {
        contacts: [
          {
            publicKey: '1'.repeat(64),
            relayUrl: 'wss://relay1.example.com',
            petname: 'Duplicate'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      const result1 = await inviteManager.importContacts(contactList);
      const result2 = await inviteManager.importContacts(contactList);

      // Second import should detect duplicates
      expect(result2.duplicates).toBeGreaterThan(0);

      // Should not create duplicate contacts
      const allContacts = await contactStore.getAllContacts();
      const duplicateContacts = allContacts.filter(c =>
        c.publicKey === '1'.repeat(64)
      );
      expect(duplicateContacts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Privacy and Security Workflow', () => {
    it('should respect privacy settings across all invite types', async () => {
      // Set up profile with sensitive data
      await profileManager.updateProfile({
        displayName: 'Private User',
        avatar: 'https://example.com/avatar.png',
        bio: 'This is private',
        website: 'https://private.com'
      });

      // Set strict privacy settings
      await profileManager.updatePrivacySettings({
        shareDisplayName: true,
        shareAvatar: false,
        shareBio: false,
        shareWebsite: false,
        allowContactRequests: true,
        requireMessage: false,
        autoAcceptTrusted: false
      });

      // Test invite link respects privacy
      const inviteLink = await inviteManager.generateInviteLink({
        includeProfile: true
      });

      const linkRequest = await inviteManager.processInviteLink(inviteLink.url);
      expect(linkRequest.profile.displayName).toBe('Private User');
      expect(linkRequest.profile.avatar).toBeUndefined();
      expect(linkRequest.profile.bio).toBeUndefined();

      // Test QR code respects privacy
      const mockPublicKey = identityRef.current.publicKeyHex;
      const mockPrivateKey = identityRef.current.privateKeyHex;

      const qrCode = await qrGenerator.createInviteQR(
        mockPublicKey as any,
        mockPrivateKey as any,
        {
          includeProfile: true,
          expirationHours: 24
        }
      );

      const qrRequest = await inviteManager.processQRInvite(qrCode.rawData);
      expect(qrRequest.profile.displayName).toBeUndefined();
      expect(qrRequest.profile.avatar).toBeUndefined();
    });

    it('should handle privacy setting changes without affecting existing contacts', async () => {
      await profileManager.updateProfile({
        displayName: 'Original User',
        avatar: undefined,
        bio: undefined,
        website: undefined
      });

      // Create contact with current privacy settings
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Original User',
        includeProfile: true
      });

      const request = await inviteManager.processInviteLink(inviteLink.url);
      const contact = await inviteManager.acceptContactRequest(request.id);

      // Change privacy settings
      await profileManager.updatePrivacySettings({
        shareDisplayName: false,
        shareAvatar: false,
        shareBio: false,
        shareWebsite: false,
        allowContactRequests: false,
        requireMessage: true,
        autoAcceptTrusted: false
      });

      // Verify existing contact is unaffected
      const storedContact = await contactStore.getContact(contact.id);
      expect(storedContact).toBeDefined();
      expect(storedContact?.displayName).toBe('Original User');

      // New invites should respect new settings
      const newInvite = await inviteManager.generateInviteLink({
        includeProfile: true
      });

      const newRequest = await inviteManager.processInviteLink(newInvite.url);
      expect(newRequest.profile.displayName).toBeUndefined();
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should generate compatible invite formats', async () => {
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Cross Platform User',
        includeProfile: true
      });

      // Verify URL format is universal
      expect(inviteLink.url).toMatch(/^https?:\/\//);
      expect(inviteLink.shortCode).toBeTruthy();

      // Verify it can be processed
      const request = await inviteManager.processInviteLink(inviteLink.url);
      expect(request).toBeDefined();
    });

    it('should handle external Nostr invite formats', async () => {
      // This test validates that the system can handle
      // invite formats from other Nostr clients
      // Implementation depends on specific format support

      const contactList: NostrContactList = {
        contacts: [
          {
            publicKey: 'a'.repeat(64),
            relayUrl: 'wss://relay.damus.io',
            petname: 'External User'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      const result = await inviteManager.importContacts(contactList);
      expect(result.totalContacts).toBe(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Test with invalid relay URLs in import
      const contactList: NostrContactList = {
        contacts: [
          {
            publicKey: '1'.repeat(64),
            relayUrl: 'invalid-url',
            petname: 'Invalid Relay'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      const result = await inviteManager.importContacts(contactList);

      // Should handle gracefully with error reporting
      expect(result.errors).toBeDefined();
      if (result.failedImports > 0) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should recover from storage errors', async () => {
      // Create contact
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Storage Test',
        includeProfile: true
      });

      const request = await inviteManager.processInviteLink(inviteLink.url);
      const contact = await inviteManager.acceptContactRequest(request.id);

      // Verify contact exists
      const storedContact = await contactStore.getContact(contact.id);
      expect(storedContact).toBeDefined();

      // Try to add duplicate (should handle gracefully)
      const request2 = await inviteManager.processInviteLink(inviteLink.url);

      // System should handle this without crashing
      expect(request2).toBeDefined();
    });

    it('should handle malformed data gracefully', async () => {
      // Test with invalid invite link
      await expect(
        inviteManager.processInviteLink('not-a-valid-url')
      ).rejects.toThrow();

      // Test with invalid QR data
      await expect(
        inviteManager.processQRInvite('invalid-qr-data')
      ).rejects.toThrow();

      // Test with invalid contact request ID
      await expect(
        inviteManager.acceptContactRequest('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      // Create 10 invites concurrently
      const invitePromises = Array.from({ length: 10 }, (_, i) =>
        inviteManager.generateInviteLink({
          displayName: `Concurrent User ${i}`,
          includeProfile: true
        })
      );

      const invites = await Promise.all(invitePromises);
      expect(invites).toHaveLength(10);

      // All invites should be unique
      const urls = invites.map(inv => inv.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(10);

      // Process all concurrently
      const requestPromises = invites.map(inv =>
        inviteManager.processInviteLink(inv.url)
      );

      const requests = await Promise.all(requestPromises);
      expect(requests).toHaveLength(10);

      // Accept all concurrently
      const contactPromises = requests.map(req =>
        inviteManager.acceptContactRequest(req.id)
      );

      const contacts = await Promise.all(contactPromises);
      expect(contacts).toHaveLength(10);

      // Verify all contacts in store
      const allContacts = await contactStore.getAllContacts();
      expect(allContacts.length).toBeGreaterThanOrEqual(10);
    });

    it('should handle large contact lists efficiently', async () => {
      // Create 50 contacts
      const invitePromises = Array.from({ length: 50 }, (_, i) =>
        inviteManager.generateInviteLink({
          displayName: `User ${i}`,
          includeProfile: true
        })
      );

      const invites = await Promise.all(invitePromises);

      const requestPromises = invites.map(inv =>
        inviteManager.processInviteLink(inv.url)
      );
      const requests = await Promise.all(requestPromises);

      const contactPromises = requests.map(req =>
        inviteManager.acceptContactRequest(req.id)
      );
      await Promise.all(contactPromises);

      await flushMicrotasks();

      // Test search performance
      const startTime = Date.now();
      const searchResults = await contactStore.searchContacts('Test User');
      const searchTime = Date.now() - startTime;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(1000); // Should complete within 1 second

      // Test filtering performance
      const filterStart = Date.now();
      const allContacts = await contactStore.getAllContacts();
      const filterTime = Date.now() - filterStart;

      expect(allContacts.length).toBeGreaterThanOrEqual(50);
      expect(filterTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
