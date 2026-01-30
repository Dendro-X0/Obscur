/**
 * Property-based tests for ContactStore
 * 
 * Tests the correctness properties defined in the smart invite system spec:
 * - Property 16: Contact Group Management
 * - Property 17: Trust Level Assignment
 * - Property 18: Contact Search and Filtering
 * - Validates Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ContactStoreImpl } from '../contact-store';
import { Contact, ContactGroup, TrustLevel, ContactFilter } from '../types';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';

describe('ContactStore Property Tests', () => {
  let contactStore: ContactStoreImpl;
  
  beforeEach(() => {
    contactStore = new ContactStoreImpl();
  });

  afterEach(async () => {
    // Clean up IndexedDB between tests
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name === 'obscur-invites') {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  // Helper arbitraries
  const validPubkey = fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 64, maxLength: 64 })
    .map(arr => arr.map(n => n.toString(16)).join('')) as fc.Arbitrary<PublicKeyHex>;
  const displayName = fc.string({ minLength: 1, maxLength: 100 });
  const trustLevel = fc.constantFrom('trusted', 'neutral', 'blocked') as fc.Arbitrary<TrustLevel>;
  const contactId = fc.string({ minLength: 1, maxLength: 50 });
  const groupId = fc.string({ minLength: 1, maxLength: 50 });
  const groupName = fc.string({ minLength: 1, maxLength: 100 });
  
  const contactMetadata = fc.record({
    source: fc.constantFrom('qr', 'link', 'import', 'manual'),
    importedFrom: fc.option(fc.string()),
    notes: fc.option(fc.string({ maxLength: 500 }))
  });

  const contact = fc.record({
    id: contactId,
    publicKey: validPubkey,
    displayName: displayName,
    avatar: fc.option(fc.webUrl()),
    bio: fc.option(fc.string({ maxLength: 500 })),
    trustLevel: trustLevel,
    groups: fc.array(groupId, { maxLength: 10 }),
    addedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    lastSeen: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })),
    metadata: contactMetadata
  }) as fc.Arbitrary<Contact>;

  const contactGroup = fc.record({
    id: groupId,
    name: groupName,
    description: fc.option(fc.string({ maxLength: 200 })),
    color: fc.option(fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 6, maxLength: 6 })
      .map(arr => arr.map(n => n.toString(16)).join(''))),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
  }) as fc.Arbitrary<ContactGroup>;

  describe('Property 16: Contact Group Management', () => {
    it('should support adding contacts to multiple groups simultaneously', () => {
      fc.assert(
        fc.asyncProperty(
          contact,
          fc.array(contactGroup, { minLength: 1, maxLength: 5 }),
          async (testContact, testGroups) => {
            // Create groups first
            for (const group of testGroups) {
              await contactStore.createGroup(group);
            }
            
            // Add contact
            await contactStore.addContact(testContact);
            
            // Add contact to multiple groups
            const groupIds = testGroups.map(g => g.id);
            for (const groupId of groupIds) {
              await contactStore.addContactToGroup(testContact.id, groupId);
            }
            
            // Verify contact is in all groups
            const updatedContact = await contactStore.getContact(testContact.id);
            expect(updatedContact).not.toBeNull();
            
            for (const groupId of groupIds) {
              expect(updatedContact!.groups).toContain(groupId);
              const contactsInGroup = await contactStore.getContactsByGroup(groupId);
              expect(contactsInGroup.some(c => c.id === testContact.id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve contact data when group is deleted', () => {
      fc.assert(
        fc.asyncProperty(
          contact,
          contactGroup,
          async (testContact, testGroup) => {
            // Create group and add contact
            await contactStore.createGroup(testGroup);
            await contactStore.addContact(testContact);
            await contactStore.addContactToGroup(testContact.id, testGroup.id);
            
            // Verify contact is in group
            let updatedContact = await contactStore.getContact(testContact.id);
            expect(updatedContact!.groups).toContain(testGroup.id);
            
            // Delete group
            await contactStore.deleteGroup(testGroup.id);
            
            // Verify contact still exists but group association is removed
            updatedContact = await contactStore.getContact(testContact.id);
            expect(updatedContact).not.toBeNull();
            expect(updatedContact!.groups).not.toContain(testGroup.id);
            expect(updatedContact!.displayName).toBe(testContact.displayName);
            expect(updatedContact!.publicKey).toBe(testContact.publicKey);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17: Trust Level Assignment', () => {
    it('should persist trust level and affect system behavior for blocked contacts', () => {
      fc.assert(
        fc.asyncProperty(
          contact,
          trustLevel,
          async (testContact, newTrustLevel) => {
            // Add contact
            await contactStore.addContact(testContact);
            
            // Set trust level
            await contactStore.setTrustLevel(testContact.id, newTrustLevel);
            
            // Verify trust level is persisted
            const updatedContact = await contactStore.getContact(testContact.id);
            expect(updatedContact!.trustLevel).toBe(newTrustLevel);
            
            // Verify trust level filtering works
            const contactsByTrustLevel = await contactStore.getContactsByTrustLevel(newTrustLevel);
            expect(contactsByTrustLevel.some(c => c.id === testContact.id)).toBe(true);
            
            // Verify blocked contacts are properly filtered
            if (newTrustLevel === 'blocked') {
              const blockedContacts = await contactStore.getBlockedContacts();
              expect(blockedContacts.some(c => c.id === testContact.id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should support bulk trust level assignment', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(contact, { minLength: 2, maxLength: 10 }),
          trustLevel,
          async (testContacts, newTrustLevel) => {
            // Add all contacts
            for (const testContact of testContacts) {
              await contactStore.addContact(testContact);
            }
            
            // Bulk set trust level
            const contactIds = testContacts.map(c => c.id);
            await contactStore.bulkSetTrustLevel(contactIds, newTrustLevel);
            
            // Verify all contacts have the new trust level
            for (const contactId of contactIds) {
              const updatedContact = await contactStore.getContact(contactId);
              expect(updatedContact!.trustLevel).toBe(newTrustLevel);
            }
            
            // Verify trust level filtering includes all contacts
            const contactsByTrustLevel = await contactStore.getContactsByTrustLevel(newTrustLevel);
            for (const contactId of contactIds) {
              expect(contactsByTrustLevel.some(c => c.id === contactId)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: Contact Search and Filtering', () => {
    it('should return only contacts that match search criteria', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(contact, { minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          async (testContacts, searchQuery) => {
            // Add all contacts
            for (const testContact of testContacts) {
              await contactStore.addContact(testContact);
            }
            
            // Search contacts
            const searchResults = await contactStore.searchContacts(searchQuery);
            
            // Verify all results match the search query
            const lowercaseQuery = searchQuery.toLowerCase();
            for (const result of searchResults) {
              const matchesDisplayName = result.displayName.toLowerCase().includes(lowercaseQuery);
              const matchesBio = result.bio?.toLowerCase().includes(lowercaseQuery) || false;
              const matchesPublicKey = result.publicKey.toLowerCase().includes(lowercaseQuery);
              const matchesNotes = result.metadata.notes?.toLowerCase().includes(lowercaseQuery) || false;
              
              expect(
                matchesDisplayName || matchesBio || matchesPublicKey || matchesNotes
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter contacts by multiple criteria correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(contact, { minLength: 10, maxLength: 30 }),
          fc.record({
            trustLevel: fc.option(trustLevel),
            groups: fc.option(fc.array(groupId, { minLength: 1, maxLength: 3 })),
            searchQuery: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
            addedAfter: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') })),
            addedBefore: fc.option(fc.date({ min: new Date('2025-01-01'), max: new Date('2030-01-01') }))
          }) as fc.Arbitrary<ContactFilter>,
          async (testContacts, filter) => {
            // Add all contacts
            for (const testContact of testContacts) {
              await contactStore.addContact(testContact);
            }
            
            // Apply filter
            const filteredResults = await contactStore.filterContacts(filter);
            
            // Verify all results match the filter criteria
            for (const result of filteredResults) {
              // Check trust level filter
              if (filter.trustLevel) {
                expect(result.trustLevel).toBe(filter.trustLevel);
              }
              
              // Check groups filter
              if (filter.groups && filter.groups.length > 0) {
                const hasMatchingGroup = filter.groups.some(groupId => 
                  result.groups.includes(groupId)
                );
                expect(hasMatchingGroup).toBe(true);
              }
              
              // Check search query filter
              if (filter.searchQuery) {
                const lowercaseQuery = filter.searchQuery.toLowerCase();
                const matchesDisplayName = result.displayName.toLowerCase().includes(lowercaseQuery);
                const matchesBio = result.bio?.toLowerCase().includes(lowercaseQuery) || false;
                const matchesPublicKey = result.publicKey.toLowerCase().includes(lowercaseQuery);
                const matchesNotes = result.metadata.notes?.toLowerCase().includes(lowercaseQuery) || false;
                
                expect(
                  matchesDisplayName || matchesBio || matchesPublicKey || matchesNotes
                ).toBe(true);
              }
              
              // Check date range filters
              if (filter.addedAfter) {
                expect(result.addedAt.getTime()).toBeGreaterThanOrEqual(filter.addedAfter.getTime());
              }
              
              if (filter.addedBefore) {
                expect(result.addedAt.getTime()).toBeLessThanOrEqual(filter.addedBefore.getTime());
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty search results correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(contact, { minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 20, maxLength: 50 }), // Long random string unlikely to match
          async (testContacts, unlikelyQuery) => {
            // Add all contacts
            for (const testContact of testContacts) {
              await contactStore.addContact(testContact);
            }
            
            // Search with unlikely query
            const searchResults = await contactStore.searchContacts(unlikelyQuery);
            
            // If no results, that's valid behavior
            // If there are results, they must match the query
            const lowercaseQuery = unlikelyQuery.toLowerCase();
            for (const result of searchResults) {
              const matchesDisplayName = result.displayName.toLowerCase().includes(lowercaseQuery);
              const matchesBio = result.bio?.toLowerCase().includes(lowercaseQuery) || false;
              const matchesPublicKey = result.publicKey.toLowerCase().includes(lowercaseQuery);
              const matchesNotes = result.metadata.notes?.toLowerCase().includes(lowercaseQuery) || false;
              
              expect(
                matchesDisplayName || matchesBio || matchesPublicKey || matchesNotes
              ).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});