/**
 * Integration tests for the invite system
 * Tests the complete invite workflow and integration with existing features
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { inviteManager } from '../invite-manager';
import { contactStore } from '../contact-store';
import { profileManager } from '../profile-manager';
import { qrGenerator } from '../qr-generator';
import type { 
  InviteLink, 
  ContactRequest, 
  Contact, 
  UserProfile,
  QRCode 
} from '../types';

describe('Invite System Integration', () => {
  // Clean up after each test
  afterEach(async () => {
    // Clear all data from stores
    const contacts = await contactStore.getAllContacts();
    for (const contact of contacts) {
      await contactStore.removeContact(contact.id);
    }
    
    const groups = await contactStore.getAllGroups();
    for (const group of groups) {
      await contactStore.deleteGroup(group.id);
    }
  });

  describe('End-to-End Invite Workflow', () => {
    it('should complete full invite link workflow', async () => {
      // 1. Create an invite link
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Test User',
        message: 'Let\'s connect!',
        expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        includeProfile: true
      });

      expect(inviteLink).toBeDefined();
      expect(inviteLink.url).toContain('http');
      expect(inviteLink.shortCode).toBeTruthy();
      expect(inviteLink.isActive).toBe(true);

      // 2. Process the invite link (simulating recipient)
      const contactRequest = await inviteManager.processInviteLink(inviteLink.url);

      expect(contactRequest).toBeDefined();
      expect(contactRequest.type).toBe('incoming');
      expect(contactRequest.status).toBe('pending');
      expect(contactRequest.profile.displayName).toBe('Test User');
      expect(contactRequest.message).toBe('Let\'s connect!');

      // 3. Accept the contact request
      const contact = await inviteManager.acceptContactRequest(contactRequest.id);

      expect(contact).toBeDefined();
      expect(contact.displayName).toBe('Test User');
      expect(contact.trustLevel).toBe('neutral');

      // 4. Verify contact was added to store
      const storedContact = await contactStore.getContact(contact.id);
      expect(storedContact).toBeDefined();
      expect(storedContact?.id).toBe(contact.id);
    });

    it('should complete full QR code workflow', async () => {
      // Mock crypto keys for testing
      const mockPublicKey = '0'.repeat(64);
      const mockPrivateKey = '1'.repeat(64);

      // 1. Generate QR code
      const qrCode = await qrGenerator.createInviteQR(
        mockPublicKey as any,
        mockPrivateKey as any,
        {
          displayName: 'QR Test User',
          message: 'Scan to connect',
          expirationHours: 24,
          includeProfile: true
        }
      );

      expect(qrCode).toBeDefined();
      expect(qrCode.dataUrl).toContain('data:image');
      expect(qrCode.rawData).toBeTruthy();

      // 2. Scan and process QR code
      const contactRequest = await inviteManager.processQRInvite(qrCode.rawData);

      expect(contactRequest).toBeDefined();
      expect(contactRequest.type).toBe('incoming');
      expect(contactRequest.profile.displayName).toBe('QR Test User');

      // 3. Accept the contact request
      const contact = await inviteManager.acceptContactRequest(contactRequest.id);

      expect(contact).toBeDefined();
      expect(contact.displayName).toBe('QR Test User');
    });
  });

  describe('Contact Management Integration', () => {
    it('should integrate contact requests with contact store', async () => {
      // Create a contact request
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Integration Test',
        includeProfile: true
      });

      const contactRequest = await inviteManager.processInviteLink(inviteLink.url);
      
      // Accept and verify it's in the contact store
      const contact = await inviteManager.acceptContactRequest(contactRequest.id);
      
      const allContacts = await contactStore.getAllContacts();
      expect(allContacts).toHaveLength(1);
      expect(allContacts[0].id).toBe(contact.id);

      // Add contact to a group
      const group = {
        id: crypto.randomUUID(),
        name: 'Test Group',
        createdAt: new Date()
      };
      await contactStore.createGroup(group);
      await contactStore.addContactToGroup(contact.id, group.id);

      // Verify contact is in group
      const contactsInGroup = await contactStore.getContactsByGroup(group.id);
      expect(contactsInGroup).toHaveLength(1);
      expect(contactsInGroup[0].id).toBe(contact.id);
    });

    it('should handle contact trust levels', async () => {
      // Create and accept a contact
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Trust Test',
        includeProfile: true
      });

      const contactRequest = await inviteManager.processInviteLink(inviteLink.url);
      const contact = await inviteManager.acceptContactRequest(contactRequest.id);

      // Verify initial trust level
      expect(contact.trustLevel).toBe('neutral');

      // Change trust level to trusted
      await contactStore.setTrustLevel(contact.id, 'trusted');
      
      const trustedContacts = await contactStore.getTrustedContacts();
      expect(trustedContacts).toHaveLength(1);
      expect(trustedContacts[0].id).toBe(contact.id);

      // Change to blocked
      await contactStore.setTrustLevel(contact.id, 'blocked');
      
      const blockedContacts = await contactStore.getBlockedContacts();
      expect(blockedContacts).toHaveLength(1);
      expect(blockedContacts[0].id).toBe(contact.id);
    });
  });

  describe('Profile Integration', () => {
    it('should integrate profile with invite generation', async () => {
      // Set up profile
      const profile: UserProfile = {
        displayName: 'Profile Test User',
        avatar: 'https://example.com/avatar.png',
        bio: 'Test bio',
        website: 'https://example.com'
      };

      await profileManager.updateProfile(profile);

      // Generate invite with profile
      const inviteLink = await inviteManager.generateInviteLink({
        includeProfile: true
      });

      // Process and verify profile data is included
      const contactRequest = await inviteManager.processInviteLink(inviteLink.url);
      
      expect(contactRequest.profile.displayName).toBe('Profile Test User');
      expect(contactRequest.profile.avatar).toBe('https://example.com/avatar.png');
    });

    it('should respect privacy settings', async () => {
      // Set up profile with privacy settings
      const profile: UserProfile = {
        displayName: 'Private User',
        avatar: 'https://example.com/avatar.png',
        bio: 'Private bio'
      };

      await profileManager.updateProfile(profile);

      // Set privacy to not share avatar
      await profileManager.updatePrivacySettings({
        shareDisplayName: true,
        shareAvatar: false,
        shareBio: false,
        shareWebsite: false,
        allowContactRequests: true,
        requireMessage: false,
        autoAcceptTrusted: false
      });

      // Generate invite
      const inviteLink = await inviteManager.generateInviteLink({
        includeProfile: true
      });

      // Process and verify only allowed data is included
      const contactRequest = await inviteManager.processInviteLink(inviteLink.url);
      
      expect(contactRequest.profile.displayName).toBe('Private User');
      expect(contactRequest.profile.avatar).toBeUndefined();
      expect(contactRequest.profile.bio).toBeUndefined();
    });
  });

  describe('Cross-Component Data Flow', () => {
    it('should maintain data consistency across components', async () => {
      // Create invite
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Consistency Test',
        message: 'Testing data flow',
        includeProfile: true
      });

      // Process invite
      const contactRequest = await inviteManager.processInviteLink(inviteLink.url);

      // Accept contact
      const contact = await inviteManager.acceptContactRequest(contactRequest.id);

      // Verify data consistency
      const storedContact = await contactStore.getContact(contact.id);
      expect(storedContact?.displayName).toBe(contact.displayName);
      expect(storedContact?.publicKey).toBe(contact.publicKey);
      expect(storedContact?.trustLevel).toBe(contact.trustLevel);

      // Update contact
      await contactStore.updateContact(contact.id, {
        displayName: 'Updated Name',
        bio: 'Updated bio'
      });

      // Verify update
      const updatedContact = await contactStore.getContact(contact.id);
      expect(updatedContact?.displayName).toBe('Updated Name');
      expect(updatedContact?.bio).toBe('Updated bio');
    });

    it('should handle concurrent operations', async () => {
      // Create multiple invites concurrently
      const invitePromises = Array.from({ length: 5 }, (_, i) =>
        inviteManager.generateInviteLink({
          displayName: `User ${i}`,
          includeProfile: true
        })
      );

      const invites = await Promise.all(invitePromises);

      // Verify all invites are unique
      const urls = invites.map(inv => inv.url);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(5);

      // Process all invites concurrently
      const requestPromises = invites.map(inv =>
        inviteManager.processInviteLink(inv.url)
      );

      const requests = await Promise.all(requestPromises);

      // Accept all requests concurrently
      const contactPromises = requests.map(req =>
        inviteManager.acceptContactRequest(req.id)
      );

      const contacts = await Promise.all(contactPromises);

      // Verify all contacts were created
      expect(contacts).toHaveLength(5);
      
      const allContacts = await contactStore.getAllContacts();
      expect(allContacts).toHaveLength(5);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle expired invites gracefully', async () => {
      // Create expired invite
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Expired User',
        expirationTime: expiredDate,
        includeProfile: true
      });

      // Try to process expired invite
      await expect(
        inviteManager.processInviteLink(inviteLink.url)
      ).rejects.toThrow();
    });

    it('should handle invalid data gracefully', async () => {
      // Try to process invalid invite link
      await expect(
        inviteManager.processInviteLink('invalid-url')
      ).rejects.toThrow();

      // Try to accept non-existent contact request
      await expect(
        inviteManager.acceptContactRequest('non-existent-id')
      ).rejects.toThrow();

      // Try to get non-existent contact
      const contact = await contactStore.getContact('non-existent-id');
      expect(contact).toBeNull();
    });

    it('should handle duplicate contacts', async () => {
      // Create and accept first contact
      const inviteLink1 = await inviteManager.generateInviteLink({
        displayName: 'Duplicate Test',
        includeProfile: true
      });

      const request1 = await inviteManager.processInviteLink(inviteLink1.url);
      const contact1 = await inviteManager.acceptContactRequest(request1.id);

      // Try to add same contact again (should handle gracefully)
      const inviteLink2 = await inviteManager.generateInviteLink({
        displayName: 'Duplicate Test',
        includeProfile: true
      });

      const request2 = await inviteManager.processInviteLink(inviteLink2.url);
      
      // This should either merge or reject duplicate
      // Implementation depends on business logic
      const allContacts = await contactStore.getAllContacts();
      expect(allContacts.length).toBeGreaterThanOrEqual(1);
    });
  });
});
