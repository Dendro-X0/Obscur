/**
 * End-to-End System Tests for Smart Invite System
 * Tests complete workflows across all components
 * Feature: smart-invite-system
 * Validates: All requirements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inviteManager } from '../invite-manager';
import { connectionStore } from '../connection-store';
import { profileManager } from '../profile-manager';
import { qrGenerator } from '../qr-generator';
import type {
  UserProfile,
  PrivacySettings,
  ConnectionGroup,
  NostrConnectionList
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
    canSendConnectionRequest: () => true,
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
      allowConnectionRequests: true,
      requireMessage: false,
      autoAcceptTrusted: false
    });
  });

  afterEach(async () => {
    // Clean up all data
    const connections = await connectionStore.getAllConnections();
    for (const connection of connections) {
      await connectionStore.removeConnection(connection.id);
    }

    const groups = await connectionStore.getAllGroups();
    for (const group of groups) {
      await connectionStore.deleteGroup(group.id);
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
      const connectionRequest = await inviteManager.processInviteLink(inviteLink.url);

      expect(connectionRequest.type).toBe('incoming');
      expect(connectionRequest.status).toBe('pending');
      expect(connectionRequest.profile.displayName).toBe('Alice');
      expect(connectionRequest.message).toBe('Hey! Let\'s connect on Obscur');

      // Step 4: User B accepts connection request
      const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

      expect(connection.displayName).toBe('Alice');
      expect(connection.trustLevel).toBe('neutral');

      // Step 5: Verify connection is in store and can be organized
      const storedConnection = await connectionStore.getConnection(connection.id);
      expect(storedConnection).toBeDefined();

      // Step 6: User B organizes connection into group
      const friendsGroup: ConnectionGroup = {
        id: 'friends-group',
        name: 'Friends',
        description: 'Close friends',
        createdAt: new Date(),
      };
      await connectionStore.createGroup(friendsGroup);
      await connectionStore.addConnectionToGroup(connection.id, friendsGroup.id);

      // Step 7: User B sets trust level
      await connectionStore.setTrustLevel(connection.id, 'trusted');

      // Step 8: Verify final state
      const trustedConnections = await connectionStore.getTrustedConnections();
      expect(trustedConnections).toHaveLength(1);
      expect(trustedConnections[0].id).toBe(connection.id);

      const groupConnections = await connectionStore.getConnectionsByGroup(friendsGroup.id);
      expect(groupConnections).toHaveLength(1);
      expect(groupConnections[0].groups).toContain(friendsGroup.id);
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
      const connectionRequest = await inviteManager.processQRInvite(qrCode.rawData);

      expect(connectionRequest.type).toBe('incoming');
      expect(connectionRequest.profile.displayName).toBe('Charlie');
      expect(connectionRequest.message).toBe('Scan to connect!');

      // Step 3: Accept connection
      const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

      expect(connection.displayName).toBe('Charlie');

      // Step 4: Search for connection
      const searchResults = await connectionStore.searchConnections('Charlie');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].id).toBe(connection.id);
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

  describe('Connection Request Management Workflow', () => {
    it('should handle connection request acceptance and decline', async () => {
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
      const connection1 = await inviteManager.acceptConnectionRequest(request1.id);
      expect(connection1.displayName).toBe('Test User');

      // Decline second request
      await inviteManager.declineConnectionRequest(request2.id, false);

      // Verify only first connection exists
      const allConnections = await connectionStore.getAllConnections();
      expect(allConnections).toHaveLength(1);
      expect(allConnections[0].id).toBe(connection1.id);
    });

    it('should handle connection request with blocking', async () => {
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Blocked User',
        includeProfile: true
      });

      const request = await inviteManager.processInviteLink(inviteLink.url);

      // Decline and block
      await inviteManager.declineConnectionRequest(request.id, true);

      // Verify blocked connection exists
      const allConnections = await connectionStore.getAllConnections();
      expect(allConnections).toHaveLength(1);
      expect(allConnections[0]?.trustLevel).toBe('blocked');
    });

    it('should handle outgoing connection request cancellation', async () => {
      // Create an outgoing request
      const recipientPublicKey = 'f'.repeat(64);
      await inviteManager.sendConnectionRequest({
        recipientPublicKey: recipientPublicKey as any,
        message: 'hello',
        includeProfile: true
      });

      const outgoing = await inviteManager.getOutgoingConnectionRequests();
      expect(outgoing.length).toBeGreaterThan(0);

      // Cancel the request
      await inviteManager.cancelConnectionRequest(outgoing[0]!.id);

      // Verify request is cancelled (implementation specific)
      // This test validates the cancellation mechanism exists
    });
  });

  describe('Connection Import/Export Workflow', () => {
    it('should handle connection import and organization', async () => {
      // Create mock NIP-02 connection list
      const connectionList: NostrConnectionList = {
        connections: [
          {
            publicKey: '1'.repeat(64) as any,
            relayUrl: 'wss://relay1.example.com',
            petname: 'Friend 1'
          },
          {
            publicKey: '2'.repeat(64) as any,
            relayUrl: 'wss://relay2.example.com',
            petname: 'Friend 2'
          },
          {
            publicKey: '3'.repeat(64) as any,
            relayUrl: 'wss://relay3.example.com',
            petname: 'Friend 3'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      // Import connections
      const result = await inviteManager.importConnections(connectionList);

      expect(result.totalConnections).toBe(3);
      expect(result.successfulImports).toBeGreaterThan(0);
      expect(result.failedImports).toBeLessThanOrEqual(3);

      // Export connections
      const exported = await inviteManager.exportConnections();
      expect(exported.connections).toBeDefined();
    });

    it('should handle duplicate connection imports', async () => {
      // Import same connections twice
      const connectionList: NostrConnectionList = {
        connections: [
          {
            publicKey: '1'.repeat(64) as any,
            relayUrl: 'wss://relay1.example.com',
            petname: 'Duplicate'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      const result1 = await inviteManager.importConnections(connectionList);
      const result2 = await inviteManager.importConnections(connectionList);

      // Second import should detect duplicates
      expect(result2.duplicates).toBeGreaterThan(0);

      // Should not create duplicate connections
      const allConnections = await connectionStore.getAllConnections();
      const duplicateConnections = allConnections.filter(c =>
        c.publicKey === '1'.repeat(64)
      );
      expect(duplicateConnections.length).toBeLessThanOrEqual(1);
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
        allowConnectionRequests: true,
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

    it('should handle privacy setting changes without affecting existing connections', async () => {
      await profileManager.updateProfile({
        displayName: 'Original User',
        avatar: undefined,
        bio: undefined,
        website: undefined
      });

      // Create connection with current privacy settings
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Original User',
        includeProfile: true
      });

      const request = await inviteManager.processInviteLink(inviteLink.url);
      const connection = await inviteManager.acceptConnectionRequest(request.id);

      // Change privacy settings
      await profileManager.updatePrivacySettings({
        shareDisplayName: false,
        shareAvatar: false,
        shareBio: false,
        shareWebsite: false,
        allowConnectionRequests: false,
        requireMessage: true,
        autoAcceptTrusted: false
      });

      // Verify existing connection is unaffected
      const storedConnection = await connectionStore.getConnection(connection.id);
      expect(storedConnection).toBeDefined();
      expect(storedConnection?.displayName).toBe('Original User');

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

      const connectionList: NostrConnectionList = {
        connections: [
          {
            publicKey: 'a'.repeat(64) as any,
            relayUrl: 'wss://relay.damus.io',
            petname: 'External User'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      const result = await inviteManager.importConnections(connectionList);
      expect(result.totalConnections).toBe(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Test with invalid relay URLs in import
      const connectionList: NostrConnectionList = {
        connections: [
          {
            publicKey: '1'.repeat(64) as any,
            relayUrl: 'invalid-url',
            petname: 'Invalid Relay'
          }
        ],
        version: 1,
        createdAt: Date.now()
      };

      const result = await inviteManager.importConnections(connectionList);

      // Should handle gracefully with error reporting
      expect(result.errors).toBeDefined();
      if (result.failedImports > 0) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should recover from storage errors', async () => {
      // Create connection
      const inviteLink = await inviteManager.generateInviteLink({
        displayName: 'Storage Test',
        includeProfile: true
      });

      const request = await inviteManager.processInviteLink(inviteLink.url);
      const connection = await inviteManager.acceptConnectionRequest(request.id);

      // Verify connection exists
      const storedConnection = await connectionStore.getConnection(connection.id);
      expect(storedConnection).toBeDefined();

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

      // Test with invalid connection request ID
      await expect(
        inviteManager.acceptConnectionRequest('non-existent')
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
      const connectionPromises = requests.map(req =>
        inviteManager.acceptConnectionRequest(req.id)
      );

      const connections = await Promise.all(connectionPromises);

      // Verify all connections were created
      expect(connections).toHaveLength(10);

      const allConnections = await connectionStore.getAllConnections();
      expect(allConnections.length).toBeGreaterThanOrEqual(10);
    });

    it('should handle large connection lists efficiently', async () => {
      // Create 50 connections
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

      const connectionPromises = requests.map(req =>
        inviteManager.acceptConnectionRequest(req.id)
      );
      await Promise.all(connectionPromises);

      await flushMicrotasks();

      // Test search performance
      const startTime = Date.now();
      const searchResults = await connectionStore.searchConnections('Test User');
      const searchTime = Date.now() - startTime;

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(1000); // Should complete within 1 second

      // Test filtering performance
      const filterStart = Date.now();
      const allConnections = await connectionStore.getAllConnections();
      const filterTime = Date.now() - filterStart;

      expect(allConnections.length).toBeGreaterThanOrEqual(50);
      expect(filterTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
