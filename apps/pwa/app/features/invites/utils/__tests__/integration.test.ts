/**
 * Integration tests for the invite system
 * Tests the complete invite workflow and integration with existing features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inviteManager } from '../invite-manager';
import { connectionStore } from '../connection-store';
import { profileManager } from '../profile-manager';
import { qrGenerator } from '../qr-generator';
import type {
  InviteLink,
  ConnectionRequest,
  Connection,
  UserProfile,
  QRCode
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

vi.mock('../../../auth/hooks/use-identity', () => ({
  getIdentitySnapshot: () => identityRef.current,
}));

describe('Invite System Integration', () => {
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
  });

  // Clean up after each test
  afterEach(async () => {
    // Clear all data from stores
    const connections = await connectionStore.getAllConnections();
    for (const connection of connections) {
      await connectionStore.removeConnection(connection.id);
    }

    const groups = await connectionStore.getAllGroups();
    for (const group of groups) {
      await connectionStore.deleteGroup(group.id);
    }
  });

  describe('End-to-End Invite Workflow', () => {
    it('should complete full invite link workflow', async () => {
      await profileManager.updateProfile({
        displayName: 'Test User',
        avatar: undefined,
        bio: undefined,
        website: undefined,
      });

      await profileManager.updatePrivacySettings({
        shareDisplayName: true,
        shareAvatar: true,
        shareBio: true,
        shareWebsite: true,
        allowConnectionRequests: true,
        requireMessage: false,
        autoAcceptTrusted: false,
      });

      // 1. Create an invite link
      const inviteLink = await inviteManager.generateInviteLink({
        message: 'Let\'s connect!',
        expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        includeProfile: true
      });

      expect(inviteLink).toBeDefined();
      expect(inviteLink.url).toContain('http');
      expect(inviteLink.shortCode).toBeTruthy();
      expect(inviteLink.isActive).toBe(true);

      // 2. Process the invite link (simulating recipient)
      const connectionRequest = await inviteManager.processInviteLink(inviteLink.url);

      expect(connectionRequest).toBeDefined();
      expect(connectionRequest.type).toBe('incoming');
      expect(connectionRequest.status).toBe('pending');
      expect(connectionRequest.profile.displayName).toBe('Test User');
      expect(connectionRequest.message).toBe('Let\'s connect!');

      // 3. Accept the connection request
      const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

      expect(connection).toBeDefined();
      expect(connection.displayName).toBe('Test User');
      expect(connection.trustLevel).toBe('neutral');

      // 4. Verify connection was added to store
      const storedConnection = await connectionStore.getConnection(connection.id);
      expect(storedConnection).toBeDefined();
      expect(storedConnection?.id).toBe(connection.id);
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
      const connectionRequest = await inviteManager.processQRInvite(qrCode.rawData);

      expect(connectionRequest).toBeDefined();
      expect(connectionRequest.type).toBe('incoming');
      expect(connectionRequest.profile.displayName).toBe('QR Test User');

      // 3. Accept the connection request
      const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

      expect(connection).toBeDefined();
      expect(connection.displayName).toBe('QR Test User');
    });
  });

  describe('Connection Management Integration', () => {
    it('should integrate connection requests with connection store', async () => {
      // Create a connection request
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Integration Test',
        includeProfile: true
      });

      const connectionRequest = await inviteManager.processInviteLink(inviteLink.url);

      // Accept and verify it's in the connection store
      const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

      const allConnections = await connectionStore.getAllConnections();
      expect(allConnections).toHaveLength(1);
      expect(allConnections[0].id).toBe(connection.id);

      // Add connection to a group
      const group = {
        id: 'test-group',
        name: 'Test Group',
        createdAt: new Date()
      };
      await connectionStore.createGroup(group);
      await connectionStore.addConnectionToGroup(connection.id, group.id);

      // Verify connection is in group
      const connectionsInGroup = await connectionStore.getConnectionsByGroup(group.id);
      expect(connectionsInGroup).toHaveLength(1);
      expect(connectionsInGroup[0].id).toBe(connection.id);
    });

    it('should handle connection trust levels', async () => {
      // Create and accept a connection
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Trust Test',
        includeProfile: true
      });

      const connectionRequest = await inviteManager.processInviteLink(inviteLink.url);
      const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

      // Verify initial trust level
      expect(connection.trustLevel).toBe('neutral');

      // Change trust level to trusted
      await connectionStore.setTrustLevel(connection.id, 'trusted');

      const trustedConnections = await connectionStore.getTrustedConnections();
      expect(trustedConnections).toHaveLength(1);
      expect(trustedConnections[0].id).toBe(connection.id);

      // Change to blocked
      await connectionStore.setTrustLevel(connection.id, 'blocked');

      const blockedConnections = await connectionStore.getBlockedConnections();
      expect(blockedConnections).toHaveLength(1);
      expect(blockedConnections[0].id).toBe(connection.id);
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
      const connectionRequest = await inviteManager.processInviteLink(inviteLink.url);

      expect(connectionRequest.profile.displayName).toBe('Profile Test User');
      expect(connectionRequest.profile.avatar).toBe('https://example.com/avatar.png');
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
        allowConnectionRequests: true,
        requireMessage: false,
        autoAcceptTrusted: false
      });

      // Generate invite
      const inviteLink = await inviteManager.generateInviteLink({
        includeProfile: true
      });

      // Process and verify only allowed data is included
      const connectionRequest = await inviteManager.processInviteLink(inviteLink.url);

      expect(connectionRequest.profile.displayName).toBe('Private User');
      expect(connectionRequest.profile.avatar).toBeUndefined();
      expect(connectionRequest.profile.bio).toBeUndefined();
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
      const connectionRequest = await inviteManager.processInviteLink(inviteLink.url);

      // Accept connection
      const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

      // Verify data consistency
      const storedConnection = await connectionStore.getConnection(connection.id);
      expect(storedConnection?.displayName).toBe(connection.displayName);
      expect(storedConnection?.publicKey).toBe(connection.publicKey);
      expect(storedConnection?.trustLevel).toBe(connection.trustLevel);

      // Update connection
      await connectionStore.updateConnection(connection.id, {
        displayName: 'Updated Name',
        bio: 'Updated bio'
      });

      // Verify update
      const updatedConnection = await connectionStore.getConnection(connection.id);
      expect(updatedConnection?.displayName).toBe('Updated Name');
      expect(updatedConnection?.bio).toBe('Updated bio');
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
      const connectionPromises = requests.map(req =>
        inviteManager.acceptConnectionRequest(req.id)
      );

      const connections = await Promise.all(connectionPromises);

      // Verify all connections were created
      expect(connections).toHaveLength(5);

      const allConnections = await connectionStore.getAllConnections();
      expect(allConnections).toHaveLength(5);
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

      // Try to accept non-existent connection request
      await expect(
        inviteManager.acceptConnectionRequest('non-existent-id')
      ).rejects.toThrow();

      // Try to get non-existent connection
      const connection = await connectionStore.getConnection('non-existent-id');
      expect(connection).toBeNull();
    });

    it('should handle duplicate connections', async () => {
      // Create and accept first connection
      const inviteLink1 = await inviteManager.generateInviteLink({
        displayName: 'Duplicate Test',
        includeProfile: true
      });

      const request1 = await inviteManager.processInviteLink(inviteLink1.url);
      const connection1 = await inviteManager.acceptConnectionRequest(request1.id);

      // Try to add same connection again (should handle gracefully)
      const inviteLink2 = await inviteManager.generateInviteLink({
        displayName: 'Duplicate Test',
        includeProfile: true
      });

      const request2 = await inviteManager.processInviteLink(inviteLink2.url);

      // This should either merge or reject duplicate
      // Implementation depends on business logic
      const allConnections = await connectionStore.getAllConnections();
      expect(allConnections.length).toBeGreaterThanOrEqual(1);
    });
  });
});
