import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validatePublicKey, formatPublicKeyPreview, isExpired } from '../utils';
import { publicKeyArbitrary, propertyTestConfig } from './test-utils';

describe('Invite System Setup', () => {
  it('should have all core utilities available', () => {
    // Test that we can use the imported utilities
    expect(validatePublicKey).toBeDefined();
    expect(formatPublicKeyPreview).toBeDefined();
    expect(isExpired).toBeDefined();
  });

  it('should validate public keys correctly', () => {
    // Valid public key (64 hex characters)
    expect(validatePublicKey('a'.repeat(64))).toBe(true);
    expect(validatePublicKey('0123456789abcdef'.repeat(4))).toBe(true);
    
    // Invalid public keys
    expect(validatePublicKey('invalid')).toBe(false);
    expect(validatePublicKey('a'.repeat(63))).toBe(false); // too short
    expect(validatePublicKey('a'.repeat(65))).toBe(false); // too long
    expect(validatePublicKey('g'.repeat(64))).toBe(false); // invalid hex
  });

  it('should format public key previews correctly', () => {
    const publicKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const preview = formatPublicKeyPreview(publicKey);
    expect(preview).toBe('01234567...89abcdef');
  });

  it('should check expiration correctly', () => {
    const now = Date.now();
    expect(isExpired(now - 1000)).toBe(true); // past
    expect(isExpired(now + 1000)).toBe(false); // future
  });
});

describe('Property-Based Testing Setup', () => {
  it('should generate valid public keys', () => {
    fc.assert(
      fc.property(publicKeyArbitrary, (publicKey) => {
        expect(validatePublicKey(publicKey)).toBe(true);
      }),
      propertyTestConfig
    );
  });

  it('should handle public key formatting consistently', () => {
    fc.assert(
      fc.property(publicKeyArbitrary, (publicKey) => {
        const preview = formatPublicKeyPreview(publicKey);
        expect(preview).toMatch(/^[0-9a-fA-F]{8}...[0-9a-fA-F]{8}$/);
        expect(preview.length).toBe(19); // 8 + 3 + 8
      }),
      propertyTestConfig
    );
  });
});