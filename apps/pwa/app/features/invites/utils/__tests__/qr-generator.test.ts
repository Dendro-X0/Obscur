import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import { qrGenerator, type QRInviteData, type QRInviteOptions } from '../qr-generator';

// Mock QRCode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
    toString: vi.fn()
  }
}));

// Mock crypto service
vi.mock('@/app/features/crypto/crypto-service', () => ({
  cryptoService: {
    generateInviteId: vi.fn(),
    signInviteData: vi.fn(),
    isValidPubkey: vi.fn()
  }
}));

// Mock jsQR
vi.mock('jsqr', () => ({
  default: vi.fn()
}));

describe('QR Generator Property Tests', () => {
  // Test data
  const validPublicKey: PublicKeyHex = 'a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc' as PublicKeyHex;
  const validPrivateKey: PrivateKeyHex = '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb' as PrivateKeyHex;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup crypto service mocks
    const QRCode = await import('qrcode');
    const { cryptoService } = await import('@/app/features/crypto/crypto-service');

    vi.mocked(QRCode.default.toDataURL).mockResolvedValue('data:image/png;base64,mock-qr-data' as never);
    vi.mocked(QRCode.default.toString).mockResolvedValue('<svg>mock-qr-svg</svg>' as never);

    vi.mocked(cryptoService.generateInviteId).mockResolvedValue('mock-invite-id-123');
    vi.mocked(cryptoService.signInviteData).mockResolvedValue('mock-signature-hex');
    vi.mocked(cryptoService.isValidPubkey).mockImplementation(async (key: string) => {
      return typeof key === 'string' && key.length === 64 && /^[0-9a-f]{64}$/i.test(key);
    });
  });

  describe('Property 1: QR Code Generation Completeness', () => {
    /**
     * For any user profile and connection metadata, generating a QR code should produce 
     * a valid QR code containing the user's public key, metadata, and expiration timestamp
     * Validates: Requirements 1.1, 1.3, 1.5
     */
    it('should generate complete QR codes for all valid invite data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            version: fc.constant('1.0'),
            publicKey: fc.constant(validPublicKey),
            displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            avatar: fc.option(fc.webUrl(), { nil: undefined }),
            message: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
            timestamp: fc.integer({ min: Date.now() - 10000, max: Date.now() }),
            expirationTime: fc.integer({ min: Date.now() + 1000, max: Date.now() + 86400000 }),
            signature: fc.string({ minLength: 64, maxLength: 128 })
          }),
          async (inviteData: QRInviteData) => {
            const qrCode = await qrGenerator.generateQR(inviteData);

            // Should have all required formats
            expect(qrCode.dataUrl).toBeTruthy();
            expect(qrCode.svgString).toBeTruthy();
            expect(qrCode.rawData).toBeTruthy();
            expect(qrCode.size).toBeGreaterThan(0);

            // Raw data should contain the invite information
            expect(qrCode.rawData).toContain('obscur-invite:');
            expect(qrCode.rawData).toContain(inviteData.publicKey);
            // Note: signature might contain special characters, so just check it's included in JSON
            const parsedFromRaw = JSON.parse(qrCode.rawData.slice('obscur-invite:'.length));
            expect(parsedFromRaw.signature).toBe(inviteData.signature);

            // Should be parseable
            const parsed = qrGenerator.parseQRData(qrCode.rawData);
            expect(parsed).not.toBeNull();
            expect(parsed?.publicKey).toBe(inviteData.publicKey);
            expect(parsed?.timestamp).toBe(inviteData.timestamp);
            expect(parsed?.expirationTime).toBe(inviteData.expirationTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include profile data when specified', async () => {
      const options: QRInviteOptions = {
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        message: 'Hello!',
        includeProfile: true,
        expirationHours: 24
      };

      const qrCode = await qrGenerator.createInviteQR(validPublicKey, validPrivateKey, options);
      const parsed = qrGenerator.parseQRData(qrCode.rawData);

      expect(parsed?.displayName).toBe(options.displayName);
      expect(parsed?.avatar).toBe(options.avatar);
      expect(parsed?.message).toBe(options.message);
    });

    it('should exclude profile data when not specified', async () => {
      const options: QRInviteOptions = {
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        includeProfile: false // Explicitly exclude
      };

      const qrCode = await qrGenerator.createInviteQR(validPublicKey, validPrivateKey, options);
      const parsed = qrGenerator.parseQRData(qrCode.rawData);

      expect(parsed?.displayName).toBeUndefined();
      expect(parsed?.avatar).toBeUndefined();
    });
  });

  describe('Property 2: QR Code Scanning Round Trip', () => {
    /**
     * For any valid QR code generated by the system, scanning it should extract 
     * the exact connection information that was originally encoded
     * Validates: Requirements 1.2
     */
    it('should maintain data integrity through generate/parse cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            avatar: fc.option(fc.webUrl(), { nil: undefined }),
            message: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: undefined }),
            expirationHours: fc.integer({ min: 1, max: 168 }) // 1 hour to 1 week
          }),
          async (options: QRInviteOptions) => {
            // Generate QR code
            const qrCode = await qrGenerator.createInviteQR(validPublicKey, validPrivateKey, options);

            // Parse it back
            const parsed = qrGenerator.parseQRData(qrCode.rawData);

            expect(parsed).not.toBeNull();
            expect(parsed?.publicKey).toBe(validPublicKey);
            expect(parsed?.version).toBe('1.0');

            // Check optional fields match what was requested
            if (options.includeProfile) {
              expect(parsed?.displayName).toBe(options.displayName);
              expect(parsed?.avatar).toBe(options.avatar);
            }
            expect(parsed?.message).toBe(options.message);

            // Timestamps should be reasonable
            const now = Date.now();
            expect(parsed?.timestamp).toBeLessThanOrEqual(now);
            expect(parsed?.timestamp).toBeGreaterThan(now - 5000); // Within last 5 seconds
            expect(parsed!.expirationTime).toBeGreaterThan(parsed!.timestamp);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate QR data format correctly', () => {
      const validData = 'obscur-invite:{"version":"1.0","publicKey":"' + validPublicKey + '","timestamp":' + Date.now() + ',"expirationTime":' + (Date.now() + 3600000) + ',"signature":"mock-sig"}';
      const invalidData = [
        '', // Empty
        'invalid-format', // Wrong format
        'obscur-invite:', // Empty JSON
        'obscur-invite:invalid-json', // Invalid JSON
        'wrong-prefix:{"valid":"json"}', // Wrong prefix
        'obscur-invite:{"version":"1.0"}' // Missing required fields
      ];

      expect(qrGenerator.validateQRData(validData)).toBe(true);

      for (const invalid of invalidData) {
        expect(qrGenerator.validateQRData(invalid)).toBe(false);
      }
    });
  });

  describe('Property 3: Expiration Enforcement', () => {
    /**
     * For any expired invite (QR code or link), processing attempts should be 
     * rejected with appropriate error messages
     * Validates: Requirements 1.4
     */
    it('should reject expired QR codes', async () => {
      // Create expired invite data
      const expiredData: QRInviteData = {
        version: '1.0',
        publicKey: validPublicKey,
        timestamp: Date.now() - 7200000, // 2 hours ago
        expirationTime: Date.now() - 3600000, // 1 hour ago (expired)
        signature: 'mock-signature'
      };

      await expect(qrGenerator.generateQR(expiredData)).rejects.toThrow('Invite has expired');
    });

    it('should accept non-expired QR codes', async () => {
      const validData: QRInviteData = {
        version: '1.0',
        publicKey: validPublicKey,
        timestamp: Date.now() - 1000, // 1 second ago
        expirationTime: Date.now() + 3600000, // 1 hour from now
        signature: 'mock-signature'
      };

      const qrCode = await qrGenerator.generateQR(validData);
      expect(qrCode).toBeTruthy();
      expect(qrCode.rawData).toContain(validPublicKey);
    });

    it('should handle various expiration times correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 168 }), // 1 hour to 1 week
          async (expirationHours: number) => {
            const options: QRInviteOptions = { expirationHours };
            const qrCode = await qrGenerator.createInviteQR(validPublicKey, validPrivateKey, options);
            const parsed = qrGenerator.parseQRData(qrCode.rawData);

            expect(parsed).not.toBeNull();

            // Check expiration time is approximately correct
            const expectedExpiration = parsed!.timestamp + (expirationHours * 60 * 60 * 1000);
            const actualExpiration = parsed!.expirationTime;

            // Allow 1 second tolerance for processing time
            expect(Math.abs(actualExpiration - expectedExpiration)).toBeLessThan(1000);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid invite data gracefully', async () => {
      const invalidData = [
        null as any,
        undefined as any,
        'not an object' as any,
        {} as any, // Missing required fields
        { version: '1.0' } as any, // Missing other fields
        {
          version: '1.0',
          publicKey: 'invalid-key',
          timestamp: Date.now(),
          expirationTime: Date.now() + 3600000,
          signature: 'sig'
        } as any // Invalid public key
      ];

      for (const invalid of invalidData) {
        await expect(qrGenerator.generateQR(invalid)).rejects.toThrow();
      }
    });

    it('should handle QR generation errors gracefully', async () => {
      const QRCode = await import('qrcode');
      vi.mocked(QRCode.default.toDataURL).mockRejectedValueOnce(new Error('QR generation failed'));

      const validData: QRInviteData = {
        version: '1.0',
        publicKey: validPublicKey,
        timestamp: Date.now(),
        expirationTime: Date.now() + 3600000,
        signature: 'mock-signature'
      };

      await expect(qrGenerator.generateQR(validData)).rejects.toThrow('QR code generation failed');
    });

    it('should validate timestamp relationships', async () => {
      const invalidTimestamps = [
        { timestamp: 0, expirationTime: Date.now() }, // Invalid timestamp
        { timestamp: Date.now(), expirationTime: Date.now() - 1000 }, // Expiration before timestamp
        { timestamp: -1, expirationTime: Date.now() }, // Negative timestamp
      ];

      for (const { timestamp, expirationTime } of invalidTimestamps) {
        const invalidData: QRInviteData = {
          version: '1.0',
          publicKey: validPublicKey,
          timestamp,
          expirationTime,
          signature: 'mock-signature'
        };

        await expect(qrGenerator.generateQR(invalidData)).rejects.toThrow();
      }
    });
  });

  describe('Data Format Validation', () => {
    it('should enforce required fields', () => {
      const baseData = {
        version: '1.0',
        publicKey: validPublicKey,
        timestamp: Date.now(),
        expirationTime: Date.now() + 3600000,
        signature: 'mock-signature'
      };

      // Test each required field
      const requiredFields = ['version', 'publicKey', 'timestamp', 'expirationTime', 'signature'];

      for (const field of requiredFields) {
        const incompleteData = { ...baseData };
        delete (incompleteData as any)[field];

        expect(qrGenerator.parseQRData(`obscur-invite:${JSON.stringify(incompleteData)}`)).toBeNull();
      }
    });

    it('should handle malformed JSON gracefully', () => {
      const malformedData = [
        'obscur-invite:{invalid-json}',
        'obscur-invite:{"unclosed": "object"',
        'obscur-invite:{"trailing": "comma",}',
        'obscur-invite:null',
        'obscur-invite:[]'
      ];

      for (const malformed of malformedData) {
        expect(qrGenerator.parseQRData(malformed)).toBeNull();
        expect(qrGenerator.validateQRData(malformed)).toBe(false);
      }
    });

    it('should handle edge case strings', () => {
      const edgeCases = [
        '', // Empty string
        'obscur-invite:', // Empty after prefix
        'obscur-invite:""', // Empty string JSON
        'obscur-invite:"not-an-object"', // String instead of object
        'obscur-invite:123', // Number instead of object
        'obscur-invite:true' // Boolean instead of object
      ];

      for (const edgeCase of edgeCases) {
        expect(qrGenerator.validateQRData(edgeCase)).toBe(false);
        expect(qrGenerator.parseQRData(edgeCase)).toBeNull();
      }
    });
  });

  describe('Integration with Crypto Service', () => {
    it('should use crypto service for invite ID generation', async () => {
      const { cryptoService } = await import('@/app/features/crypto/crypto-service');

      await qrGenerator.createInviteQR(validPublicKey, validPrivateKey);

      expect(cryptoService.generateInviteId).toHaveBeenCalled();
    });

    it('should use crypto service for signing', async () => {
      const { cryptoService } = await import('@/app/features/crypto/crypto-service');

      await qrGenerator.createInviteQR(validPublicKey, validPrivateKey);

      expect(cryptoService.signInviteData).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: validPublicKey,
          timestamp: expect.any(Number),
          expirationTime: expect.any(Number),
          inviteId: 'mock-invite-id-123'
        }),
        validPrivateKey
      );
    });

    it('should validate public keys using crypto service', async () => {
      const { cryptoService } = await import('@/app/features/crypto/crypto-service');

      const invalidData: QRInviteData = {
        version: '1.0',
        publicKey: 'invalid-key' as PublicKeyHex,
        timestamp: Date.now(),
        expirationTime: Date.now() + 3600000,
        signature: 'mock-signature'
      };

      vi.mocked(cryptoService.isValidPubkey).mockResolvedValue(false);

      await expect(qrGenerator.generateQR(invalidData)).rejects.toThrow('invalid publicKey format');
      expect(cryptoService.isValidPubkey).toHaveBeenCalledWith('invalid-key');
    });
  });
});

/**
 * Feature: smart-invite-system, Property 1: QR Code Generation Completeness
 * Validates: Requirements 1.1, 1.3, 1.5
 * 
 * Feature: smart-invite-system, Property 2: QR Code Scanning Round Trip
 * Validates: Requirements 1.2
 * 
 * Feature: smart-invite-system, Property 3: Expiration Enforcement
 * Validates: Requirements 1.4
 * 
 * These property tests validate that QR code operations maintain data integrity,
 * handle expiration correctly, and provide complete invite information.
 */