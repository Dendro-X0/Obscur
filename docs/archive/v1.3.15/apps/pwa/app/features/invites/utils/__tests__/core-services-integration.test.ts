import { describe, it, expect, beforeEach } from 'vitest';
import { connectionStore } from '../connection-store';
import { profileManager } from '../profile-manager';
import { qrGenerator } from '../qr-generator';
import { cryptoService } from '@/app/features/crypto/crypto-service';
import type { Connection, ConnectionGroup, UserProfile, PrivacySettings } from '../types';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';

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
      const allConnections = await connectionStore.getAllConnections();
      for (const connection of allConnections) {
        await connectionStore.removeConnection(connection.id);
      }

      const allGroups = await connectionStore.getAllGroups();
      for (const group of allGroups) {
        await connectionStore.deleteGroup(group.id);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Service Availability', () => {
    it('should have all core services available', () => {
      expect(connectionStore).toBeDefined();
      expect(profileManager).toBeDefined();
      expect(qrGenerator).toBeDefined();
      expect(cryptoService).toBeDefined();
    });

    it('should have all required methods on ConnectionStore', () => {
      expect(typeof connectionStore.addConnection).toBe('function');
      expect(typeof connectionStore.updateConnection).toBe('function');
      expect(typeof connectionStore.removeConnection).toBe('function');
      expect(typeof connectionStore.getConnection).toBe('function');
      expect(typeof connectionStore.getAllConnections).toBe('function');
      expect(typeof connectionStore.createGroup).toBe('function');
      expect(typeof connectionStore.deleteGroup).toBe('function');
      expect(typeof connectionStore.addConnectionToGroup).toBe('function');
      expect(typeof connectionStore.removeConnectionFromGroup).toBe('function');
      expect(typeof connectionStore.searchConnections).toBe('function');
      expect(typeof connectionStore.filterConnections).toBe('function');
      expect(typeof connectionStore.setTrustLevel).toBe('function');
      expect(typeof connectionStore.getTrustedConnections).toBe('function');
      expect(typeof connectionStore.getBlockedConnections).toBe('function');
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
    it('should create a complete connection workflow', async () => {
      // 1. Create a connection group
      const group: ConnectionGroup = {
        id: 'test-group-1',
        name: 'Test Friends',
        description: 'Test group for integration',
        color: '#blue',
        createdAt: new Date()
      };

      await connectionStore.createGroup(group);
      const retrievedGroup = await connectionStore.getGroup(group.id);
      expect(retrievedGroup).toEqual(group);

      // 2. Create a connection
      const connection: Connection = {
        id: 'test-connection-1',
        publicKey: testPublicKey as any,
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

      await connectionStore.addConnection(connection);
      const retrievedConnection = await connectionStore.getConnection(connection.id);
      expect(retrievedConnection).toEqual(connection);

      // 3. Add connection to group
      await connectionStore.addConnectionToGroup(connection.id, group.id);
      const connectionsInGroup = await connectionStore.getConnectionsByGroup(group.id);
      expect(connectionsInGroup).toHaveLength(1);
      expect(connectionsInGroup[0].id).toBe(connection.id);

      // 4. Update trust level
      await connectionStore.setTrustLevel(connection.id, 'trusted');
      const trustedConnections = await connectionStore.getTrustedConnections();
      expect(trustedConnections).toHaveLength(1);
      expect(trustedConnections[0].id).toBe(connection.id);

      // 5. Search for connection
      const searchResults = await connectionStore.searchConnections('Test User');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe(connection.id);
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
        allowConnectionRequests: true,
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
      const isValid = await profileManager.validateProfileData(shareableProfile);
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
      const keyPair = await cryptoService.generateKeyPair();
      expect(await cryptoService.isValidPubkey(keyPair.publicKey)).toBe(true);
      expect(keyPair.privateKey).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle connection store errors gracefully', async () => {
      // Try to get non-existent connection
      const nonExistentConnection = await connectionStore.getConnection('non-existent');
      expect(nonExistentConnection).toBeNull();

      // Try to update non-existent connection
      await expect(
        connectionStore.updateConnection('non-existent', { displayName: 'Updated' })
      ).rejects.toThrow();

      // Try to add connection to non-existent group
      const connection: Connection = {
        id: 'test-connection-error',
        publicKey: testPublicKey as any,
        displayName: 'Error Test',
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: { source: 'manual' }
      };

      await connectionStore.addConnection(connection);

      await expect(
        connectionStore.addConnectionToGroup(connection.id, 'non-existent-group')
      ).rejects.toThrow();
    });

    it('should handle profile manager errors gracefully', async () => {
      // Try to validate invalid profile data
      const invalidProfile = {
        publicKey: 'invalid-key',
        timestamp: Date.now(),
        signature: 'invalid-signature'
      } as any;

      const isValid = await profileManager.validateProfileData(invalidProfile);
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
      // Create a connection with specific data
      const connection: Connection = {
        id: 'consistency-test',
        publicKey: testPublicKey as any,
        displayName: 'Consistency Test User',
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: { source: 'manual' }
      };

      await connectionStore.addConnection(connection);

      // Verify the connection can be retrieved with exact same data
      const retrieved = await connectionStore.getConnection(connection.id);
      expect(retrieved).toEqual(connection);

      // Update the connection
      const updates = { displayName: 'Updated Name', trustLevel: 'trusted' as const };
      await connectionStore.updateConnection(connection.id, updates);

      // Verify updates are applied correctly
      const updated = await connectionStore.getConnection(connection.id);
      expect(updated!.displayName).toBe(updates.displayName);
      expect(updated!.trustLevel).toBe(updates.trustLevel);
      expect(updated!.id).toBe(connection.id); // ID should remain the same
      expect(updated!.publicKey).toBe(connection.publicKey); // Public key should remain the same
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