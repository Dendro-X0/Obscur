import { ContactStore } from './interfaces';
import { 
  Contact, 
  ContactGroup, 
  ContactFilter, 
  TrustLevel 
} from './types';
import { 
  CONTACTS_STORE, 
  CONTACT_GROUPS_STORE,
  ERROR_MESSAGES 
} from './constants';
import { openInviteDb } from './db/open-invite-db';
import { 
  LRUCache, 
  contactSearchIndex,
  paginateArray,
  type PaginationOptions,
  type PaginatedResult
} from './performance-optimizations';

/**
 * IndexedDB-based implementation of ContactStore interface with performance optimizations
 */
export class ContactStoreImpl implements ContactStore {
  private contactCache: LRUCache<string, Contact>;
  private groupCache: LRUCache<string, ContactGroup>;
  private allContactsCache: { data: Contact[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5000; // 5 seconds

  constructor() {
    this.contactCache = new LRUCache(100);
    this.groupCache = new LRUCache(50);
  }
  
  // Contact Management
  async addContact(contact: Contact): Promise<void> {
    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACTS_STORE);
      
      const request = store.add(contact);
      
      request.onsuccess = () => {
        // Update caches
        this.contactCache.set(contact.id, contact);
        this.allContactsCache = null; // Invalidate all contacts cache
        contactSearchIndex.addContact(contact);
        resolve();
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<void> {
    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACTS_STORE);
      
      const getRequest = store.get(contactId);
      
      getRequest.onsuccess = () => {
        const existingContact = getRequest.result;
        if (!existingContact) {
          reject(new Error(ERROR_MESSAGES.CONTACT_NOT_FOUND));
          return;
        }
        
        const updatedContact = { ...existingContact, ...updates };
        const putRequest = store.put(updatedContact);
        
        putRequest.onsuccess = () => {
          // Update caches
          this.contactCache.set(contactId, updatedContact);
          this.allContactsCache = null; // Invalidate all contacts cache
          contactSearchIndex.removeContact(contactId);
          contactSearchIndex.addContact(updatedContact);
          resolve();
        };
        putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      };
      
      getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async removeContact(contactId: string): Promise<void> {
    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACTS_STORE);
      
      const request = store.delete(contactId);
      
      request.onsuccess = () => {
        // Update caches
        this.contactCache.clear(); // Clear cache entry
        this.allContactsCache = null; // Invalidate all contacts cache
        contactSearchIndex.removeContact(contactId);
        resolve();
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getContact(contactId: string): Promise<Contact | null> {
    // Check cache first
    const cached = this.contactCache.get(contactId);
    if (cached) {
      return cached;
    }

    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACTS_STORE], 'readonly');
      const store = transaction.objectStore(CONTACTS_STORE);
      
      const request = store.get(contactId);
      
      request.onsuccess = () => {
        const contact = request.result || null;
        if (contact) {
          this.contactCache.set(contactId, contact);
        }
        resolve(contact);
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getAllContacts(): Promise<Contact[]> {
    // Check cache first
    if (this.allContactsCache && Date.now() - this.allContactsCache.timestamp < this.CACHE_TTL) {
      return this.allContactsCache.data;
    }

    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACTS_STORE], 'readonly');
      const store = transaction.objectStore(CONTACTS_STORE);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const contacts = request.result || [];
        // Update cache
        this.allContactsCache = {
          data: contacts,
          timestamp: Date.now()
        };
        // Rebuild search index if needed
        if (contactSearchIndex.size === 0 && contacts.length > 0) {
          contactSearchIndex.rebuild(contacts);
        }
        resolve(contacts);
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  /**
   * Get paginated contacts for efficient rendering of large lists
   */
  async getPaginatedContacts(options: PaginationOptions): Promise<PaginatedResult<Contact>> {
    const allContacts = await this.getAllContacts();
    return paginateArray(allContacts, options);
  }

  async getContactByPublicKey(publicKey: string): Promise<Contact | null> {
    const allContacts = await this.getAllContacts();
    return allContacts.find(contact => contact.publicKey === publicKey) || null;
  }

  // Contact Organization
  async createGroup(group: ContactGroup): Promise<void> {
    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_GROUPS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACT_GROUPS_STORE);
      
      const request = store.add(group);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async deleteGroup(groupId: string): Promise<void> {
    const db = await openInviteDb();
    
    // First, remove this group from all contacts
    const allContacts = await this.getAllContacts();
    const contactsInGroup = allContacts.filter(contact => contact.groups.includes(groupId));
    
    for (const contact of contactsInGroup) {
      await this.removeContactFromGroup(contact.id, groupId);
    }
    
    // Then delete the group itself
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_GROUPS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACT_GROUPS_STORE);
      
      const request = store.delete(groupId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getGroup(groupId: string): Promise<ContactGroup | null> {
    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_GROUPS_STORE], 'readonly');
      const store = transaction.objectStore(CONTACT_GROUPS_STORE);
      
      const request = store.get(groupId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getAllGroups(): Promise<ContactGroup[]> {
    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_GROUPS_STORE], 'readonly');
      const store = transaction.objectStore(CONTACT_GROUPS_STORE);
      
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async updateGroup(groupId: string, updates: Partial<ContactGroup>): Promise<void> {
    const db = await openInviteDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_GROUPS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACT_GROUPS_STORE);
      
      const getRequest = store.get(groupId);
      
      getRequest.onsuccess = () => {
        const existingGroup = getRequest.result;
        if (!existingGroup) {
          reject(new Error('Group not found'));
          return;
        }
        
        const updatedGroup = { ...existingGroup, ...updates };
        const putRequest = store.put(updatedGroup);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      };
      
      getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async addContactToGroup(contactId: string, groupId: string): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) {
      throw new Error(ERROR_MESSAGES.CONTACT_NOT_FOUND);
    }
    
    // Verify group exists
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    
    // Add group to contact's groups array if not already present
    if (!contact.groups.includes(groupId)) {
      const updatedGroups = [...contact.groups, groupId];
      await this.updateContact(contactId, { groups: updatedGroups });
    }
  }

  async removeContactFromGroup(contactId: string, groupId: string): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) {
      throw new Error(ERROR_MESSAGES.CONTACT_NOT_FOUND);
    }
    
    // Remove group from contact's groups array
    const updatedGroups = contact.groups.filter(id => id !== groupId);
    await this.updateContact(contactId, { groups: updatedGroups });
  }

  async addContactToMultipleGroups(contactId: string, groupIds: string[]): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) {
      throw new Error(ERROR_MESSAGES.CONTACT_NOT_FOUND);
    }
    
    // Verify all groups exist
    for (const groupId of groupIds) {
      const group = await this.getGroup(groupId);
      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }
    }
    
    // Add all new groups to contact's groups array
    const existingGroups = new Set(contact.groups);
    const newGroups = groupIds.filter(groupId => !existingGroups.has(groupId));
    
    if (newGroups.length > 0) {
      const updatedGroups = [...contact.groups, ...newGroups];
      await this.updateContact(contactId, { groups: updatedGroups });
    }
  }

  async removeContactFromMultipleGroups(contactId: string, groupIds: string[]): Promise<void> {
    const contact = await this.getContact(contactId);
    if (!contact) {
      throw new Error(ERROR_MESSAGES.CONTACT_NOT_FOUND);
    }
    
    // Remove all specified groups from contact's groups array
    const groupsToRemove = new Set(groupIds);
    const updatedGroups = contact.groups.filter(groupId => !groupsToRemove.has(groupId));
    
    await this.updateContact(contactId, { groups: updatedGroups });
  }

  async getContactsByGroup(groupId: string): Promise<Contact[]> {
    const allContacts = await this.getAllContacts();
    return allContacts.filter(contact => contact.groups.includes(groupId));
  }

  // Search and Filtering
  async searchContacts(query: string): Promise<Contact[]> {
    // Use optimized search index for better performance
    if (!query || query.trim().length === 0) {
      return this.getAllContacts();
    }

    // Ensure search index is populated
    const allContacts = await this.getAllContacts();
    if (contactSearchIndex.size === 0) {
      contactSearchIndex.rebuild(allContacts);
    }

    // Use optimized trie-based search
    return contactSearchIndex.search(query);
  }

  /**
   * Search contacts with pagination for large result sets
   */
  async searchContactsPaginated(
    query: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<Contact>> {
    const results = await this.searchContacts(query);
    return paginateArray(results, options);
  }

  async filterContacts(filter: ContactFilter): Promise<Contact[]> {
    const allContacts = await this.getAllContacts();
    
    return allContacts.filter(contact => {
      // Filter by trust level
      if (filter.trustLevel && contact.trustLevel !== filter.trustLevel) {
        return false;
      }
      
      // Filter by groups
      if (filter.groups && filter.groups.length > 0) {
        const hasMatchingGroup = filter.groups.some(groupId => 
          contact.groups.includes(groupId)
        );
        if (!hasMatchingGroup) {
          return false;
        }
      }
      
      // Filter by search query
      if (filter.searchQuery) {
        const lowercaseQuery = filter.searchQuery.toLowerCase();
        const matchesQuery = 
          contact.displayName.toLowerCase().includes(lowercaseQuery) ||
          contact.bio?.toLowerCase().includes(lowercaseQuery) ||
          contact.publicKey.toLowerCase().includes(lowercaseQuery) ||
          contact.metadata.notes?.toLowerCase().includes(lowercaseQuery);
        
        if (!matchesQuery) {
          return false;
        }
      }
      
      // Filter by date range
      if (filter.addedAfter && contact.addedAt < filter.addedAfter) {
        return false;
      }
      
      if (filter.addedBefore && contact.addedAt > filter.addedBefore) {
        return false;
      }
      
      return true;
    });
  }

  // Trust Management
  async setTrustLevel(contactId: string, level: TrustLevel): Promise<void> {
    await this.updateContact(contactId, { trustLevel: level });
  }

  async getTrustedContacts(): Promise<Contact[]> {
    return this.filterContacts({ trustLevel: 'trusted' });
  }

  async getBlockedContacts(): Promise<Contact[]> {
    return this.filterContacts({ trustLevel: 'blocked' });
  }

  async getNeutralContacts(): Promise<Contact[]> {
    return this.filterContacts({ trustLevel: 'neutral' });
  }

  async getContactsByTrustLevel(level: TrustLevel): Promise<Contact[]> {
    return this.filterContacts({ trustLevel: level });
  }

  async bulkSetTrustLevel(contactIds: string[], level: TrustLevel): Promise<void> {
    for (const contactId of contactIds) {
      await this.setTrustLevel(contactId, level);
    }
  }
}

// Export singleton instance
export const contactStore = new ContactStoreImpl();