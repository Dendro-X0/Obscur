import { describe, it, expect, beforeEach } from 'vitest';
import { contactStore } from '../contact-store';
import { profileManager } from '../profile-manager';
import { qrGenerator } from '../qr-generator';
import { cryptoService } from '../../crypto/crypto-service';
import type { Contact, ContactGroup, UserProfile, PrivacySettings } from '../types';
import type { PublicKeyHex, PrivateKeyHex } from '@dweb/crypto';

/**
 * Core Services Integration Tests
 * 
 * These tests validate that all core services work together correctly
 * and that their interfaces are properly implemented.
 */
describe('Core Services Integration', () => {
  // Test data
  const testPublicKey: PublicKeyHex = 'a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc' as PublicKeyHex;
  const testPrivateKey: PrivateKeyHex = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb' as PrivateKeyHex;

  beforeEach(async () => {
    // Clear any existing data before each test
    try {
      const allContacts = await contactStore.getAllContacts();
      for (const contact of allContacts) {
        await contactStore.removeContact(contact.id);
      }
      
      const allGroups = await contactStore.getAllGroups();
      for (const group of allGroups) {
        await contactStore.deleteGroup(group.id);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Service Availability', () => {
    it('should have all core services available', () => {
      expect(contactStore).toBeDefined();
      expect(profileManager).toBeDefined();
      expect(qrGenerator).toBeDefined();
      expect(cryptoService).toBeDefined();
    });

    it('should have all required methods on ContactStore', () => {
      expect(typeof contactStore.addContact).toBe('function');
      expect(typeof contactStore.updateContact).toBe('function');
      expect(typeof contactStore.removeContact).toBe('function');
      expect(typeof contactStore.getContact).toBe('function');
      expect(typeof contactStore.getAllContacts).toBe('function');
      expect(typeof contactStore.createGroup).toBe('function');
      expect(typeof contactStore.deleteGroup).toBe('function');
      expect(typeof contactStore.addContactToGroup).toBe('function');
      expect(typeof contactStore.removeContactFromGroup).toBe('function');
      expect(typeof contactStore.searchContacts).toBe('function');
      expect(typeof contactStore.filterContacts).toBe('function');
      expect(typeof contactStore.setTrustLevel).toBe('function');
      expect(typeof contactStore.getTrustedContacts).toBe('function');
      expect(typeof contactStore.getBlockedContacts).toBe('function');
    });

    it('should have all required methods on ProfileManager', () => {
      expect(typeof profileManager.updateProfile).toBe('function');
      expect(typeof profileManager.getProfile).toBe('function');
      expect(typeof profileManager.updatePrivacySettings).toBe('function');
      expect(typeof profileManager.getPrivacySettings).toBe('function');
      expect(typeof profileManager.getShareableProfile).toBe('function');
      expect(typeof profileManager.validateProfileData).toBe('function');
    });

    it('should have all required methods on QRGenerator', () => {
      expect(typeof qrGenerator.generateQR).toBe('function');
      expect(typeof qrGenerator.scanQR).toBe('function');
      expect(typeof qrGenerator.validateQRData).toBe('function');
      expect(typeof qrGenerator.createInviteQR).toBe('function');
      expect(typeof qrGenerator.parseQRData).toBe('function');
    });

    it('should have all required methods on CryptoService', () => {
      expect(typeof cryptoService.encryptDM).toBe('function');
      expect(typeof cryptoService.decryptDM).toBe('function');
      expect(typeof cryptoService.signEvent).toBe('function');
      expect(typeof cryptoService.verifyEventSignature).toBe('function');
      expect(typeof cryptoService.generateKeyPair).toBe('function');
      expect(typeof cryptoService.generateInviteId).toBe('function');
      expect(typeof cryptoService.signInviteData).toBe('function');
      expect(typeof cryptoService.verifyInviteSignature).toBe('function');
      expect(typeof cryptoService.encryptInviteData).toBe('function');
      expect(typeof cryptoService.decryptInviteData).toBe('function');
      expect(typeof cryptoService.generateSecureRandom).toBe('function');
      expect(typeof cryptoService.isValidPubkey).toBe('function');
    });
  });

  describe('Service Integration Workflows', () => {
    it('should create a complete contact workflow', async () => {
      // 1. Create a contact group
      const group: ContactGroup = {
        id: 'test-group-1',
        name: 'Test Friends',
        description: 'Test group for integration',
        color: '#blue',
        createdAt: new Date()
      };
      
      await contactStore.createGroup(group);
      const retrievedGroup = await contactStore.getGroup(group.id);
      expect(retrievedGroup).toEqual(group);

      // 2. Create a contact
      const contact: Contact = {
        id: 'test-contact-1',
        publicKey: testPublicKey,
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Test user for integration',
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: {
          source: 'manual',
          notes: 'Added during integration test'
        }
      };

      await contactStore.addContact(contact);
      const retrievedContact = await contactStore.getContact(contact.id);
      expect(retrievedContact).toEqual(contact);

      // 3. Add contact to group
      await contactStore.addContactToGroup(contact.id, group.id);
      const contactsInGroup = await contactStore.getContactsByGroup(group.id);
      expect(contactsInGroup).toHaveLength(1);
      expect(contactsInGroup[0].id).toBe(contact.id);

      // 4. Update trust level
      await contactStore.setTrustLevel(contact.id, 'trusted');
      const trustedContacts = await contactStore.getTrustedContacts();
      expect(trustedContacts).toHaveLength(1);
      expect(trustedContacts[0].id).toBe(contact.id);

      // 5. Search for contact
      const searchResults = await contactStore.searchContacts('Test User');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe(contact.id);
    });

    it('should create a complete profile and QR workflow', async () => {
      // 1. Set up user profile
      const profile: UserProfile = {
        displayName: 'Integration Test User',
        avatar: 'https://example.com/test-avatar.jpg',
        bio: 'Testing profile integration',
        website: 'https://example.com',
        nip05: 'test@example.com',
        lud16: 'test@wallet.example.com'
      };

      await profileManager.updateProfile(profile);
      const retrievedProfile = await profileManager.getProfile();
      expect(retrievedProfile).toEqual(profile);

      // 2. Set up privacy settings
      const privacySettings: PrivacySettings = {
        shareDisplayName: true,
        shareAvatar: true,
        shareBio: false,
        shareWebsite: false,
        allowContactRequests: true,
        requireMessage: true,
        autoAcceptTrusted: false
      };

      await profileManager.updatePrivacySettings(privacySettings);
      const retrievedSettings = await profileManager.getPrivacySettings();
      expect(retrievedSettings).toEqual(privacySettings);

      // 3. Generate shareable profile
      const shareableProfile = await profileManager.getShareableProfile(testPublicKey, testPrivateKey);
      expect(shareableProfile.publicKey).toBe(testPublicKey);
      expect(shareableProfile.displayName).toBe(profile.displayName); // Should be shared
      expect(shareableProfile.avatar).toBe(profile.avatar); // Should be shared
      expect(shareableProfile.bio).toBeUndefined(); // Should not be shared
      expect(shareableProfile.signature).toBeTruthy();

      // 4. Validate shareable profile
      const isValid = profileManager.validateProfileData(shareableProfile);
      expect(isValid).toBe(true);

      // 5. Generate QR code from profile
      const qrCode = await qrGenerator.createInviteQR(testPublicKey, testPrivateKey, {
        displayName: profile.displayName,
        avatar: profile.avatar,
        message: 'Let\'s connect!',
        expirationHours: 24,
        includeProfile: true
      });

      expect(qrCode.dataUrl).toBeTruthy();
      expect(qrCode.svgString).toBeTruthy();
      expect(qrCode.rawData).toBeTruthy();
      expect(qrCode.size).toBe(256);

      // 6. Validate QR data
      const isValidQR = qrGenerator.validateQRData(qrCode.rawData);
      expect(isValidQR).toBe(true);

      // 7. Parse QR data back
      const parsedData = qrGenerator.parseQRData(qrCode.rawData);
      expect(parsedData).toBeTruthy();
      expect(parsedData!.publicKey).toBe(testPublicKey);
      expect(parsedData!.displayName).toBe(profile.displayName);
    });

    it('should validate crypto service integration', async () => {
      // 1. Generate invite ID
      const inviteId1 = cryptoService.generateInviteId();
      const inviteId2 = cryptoService.generateInviteId();
      
      expect(inviteId1).toBeTruthy();
      expect(inviteId2).toBeTruthy();
      expect(inviteId1).not.toBe(inviteId2); // Should be unique
      expect(inviteId1).toMatch(/^[0-9a-f]{32}$/); // Should be 32 hex chars

      // 2. Test public key validation
      expect(cryptoService.isValidPubkey(testPublicKey)).toBe(true);
      expect(cryptoService.isValidPubkey('invalid')).toBe(false);

      // 3. Test secure random generation
      const random1 = cryptoService.generateSecureRandom(16);
      const random2 = cryptoService.generateSecureRandom(16);
      
      expect(random1).toHaveLength(16);
      expect(random2).toHaveLength(16);
      expect(random1).not.toEqual(random2); // Should be different

      // 4. Test key generation
      const keyPair = await cryptoService.generateKeyPair();
      expect(cryptoService.isValidPubkey(keyPair.publicKey)).toBe(true);
      expect(keyPair.privateKey).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle contact store errors gracefully', async () => {
      // Try to get non-existent contact
      const nonExistentContact = await contactStore.getContact('non-existent');
      expect(nonExistentContact).toBeNull();

      // Try to update non-existent contact
      await expect(
        contactStore.updateContact('non-existent', { displayName: 'Updated' })
      ).rejects.toThrow();

      // Try to add contact to non-existent group
      const contact: Contact = {
        id: 'test-contact-error',
        publicKey: testPublicKey,
        displayName: 'Error Test',
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: { source: 'manual' }
      };

      await contactStore.addContact(contact);
      
      await expect(
        contactStore.addContactToGroup(contact.id, 'non-existent-group')
      ).rejects.toThrow();
    });

    it('should handle profile manager errors gracefully', async () => {
      // Try to validate invalid profile data
      const invalidProfile = {
        publicKey: 'invalid-key',
        timestamp: Date.now(),
        signature: 'invalid-signature'
      } as any;

      const isValid = profileManager.validateProfileData(invalidProfile);
      expect(isValid).toBe(false);

      // Try to update with invalid profile
      await expect(
        profileManager.updateProfile({
          displayName: '', // Empty display name should be invalid
        } as any)
      ).rejects.toThrow();
    });

    it('should handle QR generator errors gracefully', async () => {
      // Try to validate invalid QR data
      expect(qrGenerator.validateQRData('')).toBe(false);
      expect(qrGenerator.validateQRData('invalid-data')).toBe(false);
      expect(qrGenerator.validateQRData('not-json')).toBe(false);

      // Try to parse invalid QR data
      const parsedInvalid = qrGenerator.parseQRData('invalid-data');
      expect(parsedInvalid).toBeNull();

      // Try to generate QR with invalid data
      const invalidQRData = {
        version: '1.0',
        publicKey: 'invalid-key', // Invalid public key
        timestamp: Date.now(),
        expirationTime: Date.now() + 3600000,
        signature: 'test-signature'
      } as any;

      await expect(
        qrGenerator.generateQR(invalidQRData)
      ).rejects.toThrow();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across services', async () => {
      // Create a contact with specific data
      const contact: Contact = {
        id: 'consistency-test',
        publicKey: testPublicKey,
        displayName: 'Consistency Test User',
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: { source: 'test' }
      };

      await contactStore.addContact(contact);

      // Verify the contact can be retrieved with exact same data
      const retrieved = await contactStore.getContact(contact.id);
      expect(retrieved).toEqual(contact);

      // Update the contact
      const updates = { displayName: 'Updated Name', trustLevel: 'trusted' as const };
      await contactStore.updateContact(contact.id, updates);

      // Verify updates are applied correctly
      const updated = await contactStore.getContact(contact.id);
      expect(updated!.displayName).toBe(updates.displayName);
      expect(updated!.trustLevel).toBe(updates.trustLevel);
      expect(updated!.id).toBe(contact.id); // ID should remain the same
      expect(updated!.publicKey).toBe(contact.publicKey); // Public key should remain the same
    });

    it('should maintain profile consistency', async () => {
      const profile: UserProfile = {
        displayName: 'Profile Consistency Test',
        bio: 'Testing profile consistency'
      };

      await profileManager.updateProfile(profile);
      const retrieved1 = await profileManager.getProfile();
      expect(retrieved1).toEqual(profile);

      // Update profile partially
      const partialUpdate: Partial<UserProfile> = {
        avatar: 'https://example.com/new-avatar.jpg'
      };

      const updatedProfile = { ...profile, ...partialUpdate };
      await profileManager.updateProfile(updatedProfile);
      
      const retrieved2 = await profileManager.getProfile();
      expect(retrieved2).toEqual(updatedProfile);
      expect(retrieved2.displayName).toBe(profile.displayName); // Should preserve existing data
      expect(retrieved2.avatar).toBe(partialUpdate.avatar); // Should have new data
    });
  });
});