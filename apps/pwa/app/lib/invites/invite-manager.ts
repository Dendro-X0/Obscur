import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import type {
  InviteManager,
  QRGenerator,
  ContactStore,
  ProfileManager
} from './interfaces';
import type {
  QRInviteOptions,
  InviteLinkOptions,
  QRInviteData,
  ContactRequest,
  OutgoingContactRequest,
  Contact,
  InviteLink,
  ImportResult,
  NostrContactList,
  ContactRequestStatus,
  ShareableProfile
} from './types';
import { cryptoService } from '../crypto/crypto-service';
import { qrGenerator } from './qr-generator';
import { contactStore } from './contact-store';
import { profileManager } from './profile-manager';
import { openInviteDb } from './db/open-invite-db';
import { getIdentitySnapshot } from '../identity/use-identity';
import {
  CONTACT_REQUESTS_STORE,
  INVITE_LINKS_STORE,
  MAX_PENDING_REQUESTS,
  DEFAULT_INVITE_EXPIRATION_HOURS,
  SHORT_CODE_LENGTH,
  INVITE_LINK_BASE_URL,
  MAX_IMPORT_BATCH_SIZE,
  IMPORT_RATE_LIMIT_MS,
  ERROR_MESSAGES
} from './constants';
import { generateRandomString, isExpired, delay } from './utils';
import { NostrCompatibilityService, NostrRelayValidator } from './nostr-compatibility';
import { DeepLinkHandler, type DeepLinkResult } from './deep-link-handler';
import {
  InputValidator,
  SecureStorage,
  canGenerateQR,
  canGenerateInviteLink,
  canSendContactRequest,
  canProcessInvite
} from './security-enhancements';

/**
 * Central orchestrator for all invite-related operations
 */
class InviteManagerImpl implements InviteManager {

  // QR Code Operations
  async generateQRInvite(options: QRInviteOptions): Promise<QRInviteData> {
    try {
      // Get current user's identity (this would come from the app's identity system)
      const identity = await this.getCurrentUserIdentity();

      // Rate limiting check
      if (!canGenerateQR(identity.publicKey)) {
        throw new Error('Rate limit exceeded for QR code generation. Please try again later.');
      }

      // Validate and sanitize input
      if (options.displayName) {
        const validation = InputValidator.validateDisplayName(options.displayName);
        if (!validation.isValid) {
          throw new Error(`Invalid display name: ${validation.error}`);
        }
        options.displayName = validation.sanitized;
      }

      if (options.avatar) {
        const validation = InputValidator.validateUrl(options.avatar);
        if (!validation.isValid) {
          throw new Error(`Invalid avatar URL: ${validation.error}`);
        }
      }

      if (options.message) {
        const validation = InputValidator.validateMessage(options.message);
        if (!validation.isValid) {
          throw new Error(`Invalid message: ${validation.error}`);
        }
        options.message = validation.sanitized;
      }

      const now = Date.now();
      const expirationHours = options.expirationHours ?? DEFAULT_INVITE_EXPIRATION_HOURS;
      const expirationTime = now + (expirationHours * 60 * 60 * 1000);

      // Create invite data structure
      const inviteData = {
        publicKey: identity.publicKey,
        displayName: options.includeProfile ? options.displayName : undefined,
        avatar: options.includeProfile ? options.avatar : undefined,
        message: options.message,
        timestamp: now,
        expirationTime,
        inviteId: cryptoService.generateInviteId()
      };

      // Sign the invite data
      const signature = await cryptoService.signInviteData(inviteData, identity.privateKey);

      // Create QR invite data
      const qrData: QRInviteData = {
        version: '1.0',
        publicKey: identity.publicKey,
        displayName: inviteData.displayName,
        avatar: inviteData.avatar,
        message: inviteData.message,
        timestamp: inviteData.timestamp,
        expirationTime: inviteData.expirationTime,
        signature
      };

      return qrData;
    } catch (error) {
      throw new Error(`QR invite generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processQRInvite(qrData: string): Promise<ContactRequest> {
    try {
      // Get current user identity for rate limiting
      const identity = await this.getCurrentUserIdentity();

      // Rate limiting check
      if (!canProcessInvite(identity.publicKey)) {
        throw new Error('Rate limit exceeded for invite processing. Please try again later.');
      }

      // Try parsing with cross-platform compatibility
      let parsedData = NostrCompatibilityService.parseAnyFormat(qrData);

      if (!parsedData) {
        // Fallback to legacy parsing
        parsedData = qrGenerator.parseQRData(qrData);
      }

      if (!parsedData) {
        throw new Error(ERROR_MESSAGES.INVALID_QR_CODE);
      }

      // Validate public key
      const pkValidation = InputValidator.validatePublicKey(parsedData.publicKey);
      if (!pkValidation.isValid) {
        throw new Error(`Invalid public key in QR code: ${pkValidation.error}`);
      }

      // Validate timestamp
      const tsValidation = InputValidator.validateTimestamp(parsedData.timestamp);
      if (!tsValidation.isValid) {
        throw new Error(`Invalid timestamp in QR code: ${tsValidation.error}`);
      }

      // Check if expired
      if (isExpired(parsedData.expirationTime)) {
        throw new Error(ERROR_MESSAGES.EXPIRED_INVITE);
      }

      // Verify signature
      const isValidSignature = await cryptoService.verifyInviteSignature(
        parsedData,
        parsedData.signature,
        parsedData.publicKey
      );

      if (!isValidSignature) {
        throw new Error(ERROR_MESSAGES.INVALID_SIGNATURE);
      }

      // Create shareable profile from QR data
      const shareableProfile: ShareableProfile = {
        publicKey: parsedData.publicKey,
        displayName: parsedData.displayName,
        avatar: parsedData.avatar,
        timestamp: parsedData.timestamp,
        signature: parsedData.signature
      };

      // Create contact request
      const contactRequest: ContactRequest = {
        id: cryptoService.generateInviteId(),
        type: 'incoming',
        senderPublicKey: parsedData.publicKey,
        recipientPublicKey: identity.publicKey,
        profile: shareableProfile,
        message: parsedData.message,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(parsedData.expirationTime)
      };

      // Store the contact request
      await this.storeContactRequest(contactRequest);

      return contactRequest;
    } catch (error) {
      throw new Error(`QR invite processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Link Operations
  async generateInviteLink(options: InviteLinkOptions): Promise<InviteLink> {
    try {
      // Get current user's identity
      const identity = await this.getCurrentUserIdentity();

      // Rate limiting check
      if (!canGenerateInviteLink(identity.publicKey)) {
        throw new Error('Rate limit exceeded for invite link generation. Please try again later.');
      }

      // Validate and sanitize message if provided
      if (options.message) {
        const validation = InputValidator.validateMessage(options.message);
        if (!validation.isValid) {
          throw new Error(`Invalid message: ${validation.error}`);
        }
        options.message = validation.sanitized;
      }

      // Get shareable profile
      const shareableProfile = await profileManager.getShareableProfile(
        identity.publicKey,
        identity.privateKey
      );

      const now = new Date();
      const expiresAt = options.expirationTime || new Date(now.getTime() + (DEFAULT_INVITE_EXPIRATION_HOURS * 60 * 60 * 1000));

      // Generate unique short code
      const shortCode = await this.generateUniqueShortCode();

      // Create invite link
      const inviteLink: InviteLink = {
        id: cryptoService.generateInviteId(),
        url: `${INVITE_LINK_BASE_URL}/${shortCode}`,
        shortCode,
        createdBy: identity.publicKey,
        profile: shareableProfile,
        message: options.message,
        expiresAt: options.expirationTime ? expiresAt : undefined,
        maxUses: options.maxUses,
        currentUses: 0,
        isActive: true,
        createdAt: now
      };

      // Store the invite link securely
      await this.storeInviteLink(inviteLink);

      // Store sensitive invite data with encryption
      await SecureStorage.storeEncrypted(
        `invite-link-${inviteLink.id}`,
        JSON.stringify({ shortCode, createdBy: identity.publicKey })
      );

      return inviteLink;
    } catch (error) {
      throw new Error(`Invite link generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateUniversalInviteLink(options: InviteLinkOptions): Promise<{
    inviteLink: InviteLink;
    universalLink: string;
    fallbackUrl: string;
    appScheme: string;
  }> {
    try {
      // Generate standard invite link
      const inviteLink = await this.generateInviteLink(options);

      // Generate universal link with cross-platform compatibility
      const universalLinkData = NostrCompatibilityService.generateUniversalLink(inviteLink);

      return {
        inviteLink,
        universalLink: universalLinkData.url,
        fallbackUrl: universalLinkData.fallbackUrl,
        appScheme: universalLinkData.appScheme
      };
    } catch (error) {
      throw new Error(`Universal invite link generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateNostrCompatibleQR(options: QRInviteOptions): Promise<{
    qrData: QRInviteData;
    formats: {
      obscur: string;
      nostr: string;
      universal: string;
    };
  }> {
    try {
      // Generate standard QR invite
      const qrData = await this.generateQRInvite(options);

      // Generate multiple formats for compatibility
      const formats = NostrCompatibilityService.generateCompatibleQRData(qrData);

      return { qrData, formats };
    } catch (error) {
      throw new Error(`Nostr-compatible QR generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Deep Link Processing
  async processDeepLink(url: string): Promise<DeepLinkResult> {
    try {
      return await DeepLinkHandler.processDeepLink(url);
    } catch (error) {
      throw new Error(`Deep link processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleUrlScheme(url: string): Promise<ContactRequest | null> {
    try {
      const result = await this.processDeepLink(url);

      if (result.success && result.contactRequest) {
        return result.contactRequest;
      }

      // Handle fallback cases
      if (result.fallbackAction) {
        throw new Error(`Deep link failed: ${result.error}. Fallback action: ${result.fallbackAction}`);
      }

      return null;
    } catch (error) {
      throw new Error(`URL scheme handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processInviteLink(linkData: string): Promise<ContactRequest> {
    try {
      // Check if this is a deep link URL that needs parsing
      if (linkData.includes('://') || linkData.includes('nostr:')) {
        const deepLinkResult = await DeepLinkHandler.processDeepLink(linkData);
        if (deepLinkResult.success && deepLinkResult.contactRequest) {
          return deepLinkResult.contactRequest;
        }
        throw new Error(deepLinkResult.error || 'Failed to process deep link');
      }

      // Extract short code from link
      const shortCode = this.extractShortCodeFromLink(linkData);
      if (!shortCode) {
        throw new Error('Invalid invite link format');
      }

      // Retrieve invite link from storage
      const inviteLink = await this.getInviteLinkByShortCode(shortCode);
      if (!inviteLink) {
        throw new Error('Invite link not found');
      }

      // Check if link is active
      if (!inviteLink.isActive) {
        throw new Error('Invite link has been revoked');
      }

      // Check if expired
      if (inviteLink.expiresAt && isExpired(inviteLink.expiresAt.getTime())) {
        throw new Error(ERROR_MESSAGES.EXPIRED_INVITE);
      }

      // Check usage limits
      if (inviteLink.maxUses && inviteLink.currentUses >= inviteLink.maxUses) {
        throw new Error('Invite link usage limit exceeded');
      }

      // Get current user identity
      const identity = await this.getCurrentUserIdentity();

      // Create contact request
      const contactRequest: ContactRequest = {
        id: cryptoService.generateInviteId(),
        type: 'incoming',
        senderPublicKey: inviteLink.createdBy,
        recipientPublicKey: identity.publicKey,
        profile: inviteLink.profile,
        message: inviteLink.message,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: inviteLink.expiresAt
      };

      // Store the contact request
      await this.storeContactRequest(contactRequest);

      // Increment usage count
      await this.incrementInviteLinkUsage(inviteLink.id);

      return contactRequest;
    } catch (error) {
      throw new Error(`Invite link processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async revokeInviteLink(linkId: string): Promise<void> {
    try {
      const db = await openInviteDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([INVITE_LINKS_STORE], 'readwrite');
        const store = transaction.objectStore(INVITE_LINKS_STORE);

        const getRequest = store.get(linkId);

        getRequest.onsuccess = () => {
          const inviteLink = getRequest.result;
          if (!inviteLink) {
            reject(new Error('Invite link not found'));
            return;
          }

          // Mark as inactive
          inviteLink.isActive = false;

          const putRequest = store.put(inviteLink);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
        };

        getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      });
    } catch (error) {
      throw new Error(`Invite link revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Contact Request Management
  async sendContactRequest(request: OutgoingContactRequest): Promise<void> {
    try {
      // Get current user identity
      const identity = await this.getCurrentUserIdentity();

      // Rate limiting check
      if (!canSendContactRequest(identity.publicKey)) {
        throw new Error('Rate limit exceeded for contact requests. Please try again later.');
      }

      // Validate recipient public key
      const pkValidation = InputValidator.validatePublicKey(request.recipientPublicKey);
      if (!pkValidation.isValid) {
        throw new Error(`Invalid recipient public key: ${pkValidation.error}`);
      }
      request.recipientPublicKey = pkValidation.normalized!;

      // Validate and sanitize message if provided
      if (request.message) {
        const validation = InputValidator.validateMessage(request.message);
        if (!validation.isValid) {
          throw new Error(`Invalid message: ${validation.error}`);
        }
        request.message = validation.sanitized;
      }

      // Get shareable profile if requested
      let shareableProfile: ShareableProfile;
      if (request.includeProfile) {
        shareableProfile = await profileManager.getShareableProfile(
          identity.publicKey,
          identity.privateKey
        );
      } else {
        // Create minimal profile with just public key
        shareableProfile = {
          publicKey: identity.publicKey,
          timestamp: Date.now(),
          signature: await cryptoService.signInviteData(
            { publicKey: identity.publicKey, timestamp: Date.now() },
            identity.privateKey
          )
        };
      }

      // Create contact request
      const contactRequest: ContactRequest = {
        id: cryptoService.generateInviteId(),
        type: 'outgoing',
        senderPublicKey: identity.publicKey,
        recipientPublicKey: request.recipientPublicKey,
        profile: shareableProfile,
        message: request.message,
        status: 'pending',
        createdAt: new Date()
      };

      // Store the contact request
      await this.storeContactRequest(contactRequest);

      // TODO: Send the contact request via Nostr relay
      // This would involve creating a Nostr event and publishing it
      // For now, we just store it locally
    } catch (error) {
      throw new Error(`Contact request sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async acceptContactRequest(requestId: string): Promise<Contact> {
    try {
      // Get the contact request
      const contactRequest = await this.getContactRequest(requestId);
      if (!contactRequest) {
        throw new Error('Contact request not found');
      }

      if (contactRequest.status !== 'pending') {
        throw new Error('Contact request is not pending');
      }

      // Create contact from the request
      const contact: Contact = {
        id: cryptoService.generateInviteId(),
        publicKey: contactRequest.senderPublicKey,
        displayName: contactRequest.profile.displayName || `User ${contactRequest.senderPublicKey.slice(0, 8)}`,
        avatar: contactRequest.profile.avatar,
        bio: contactRequest.profile.bio,
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: {
          source: 'qr', // This could be 'qr' or 'link' depending on how the request was created
          notes: contactRequest.message
        }
      };

      // Add contact to store
      await contactStore.addContact(contact);

      // Update contact request status
      await this.updateContactRequestStatus(requestId, 'accepted');

      return contact;
    } catch (error) {
      throw new Error(`Contact request acceptance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async declineContactRequest(requestId: string, block?: boolean): Promise<void> {
    try {
      // Get the contact request
      const contactRequest = await this.getContactRequest(requestId);
      if (!contactRequest) {
        throw new Error('Contact request not found');
      }

      if (contactRequest.status !== 'pending') {
        throw new Error('Contact request is not pending');
      }

      // Update contact request status
      await this.updateContactRequestStatus(requestId, 'declined');

      // If blocking is requested, add to blocked contacts
      if (block) {
        const blockedContact: Contact = {
          id: cryptoService.generateInviteId(),
          publicKey: contactRequest.senderPublicKey,
          displayName: `Blocked ${contactRequest.senderPublicKey.slice(0, 8)}`,
          trustLevel: 'blocked',
          groups: [],
          addedAt: new Date(),
          metadata: {
            source: 'qr',
            notes: 'Blocked from contact request'
          }
        };

        await contactStore.addContact(blockedContact);
      }
    } catch (error) {
      throw new Error(`Contact request decline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelContactRequest(requestId: string): Promise<void> {
    try {
      // Get the contact request
      const contactRequest = await this.getContactRequest(requestId);
      if (!contactRequest) {
        throw new Error('Contact request not found');
      }

      if (contactRequest.type !== 'outgoing') {
        throw new Error('Can only cancel outgoing contact requests');
      }

      if (contactRequest.status !== 'pending') {
        throw new Error('Contact request is not pending');
      }

      // Update contact request status
      await this.updateContactRequestStatus(requestId, 'cancelled');
    } catch (error) {
      throw new Error(`Contact request cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Additional Contact Request Management Methods
  async getPendingContactRequests(): Promise<ContactRequest[]> {
    try {
      const db = await openInviteDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONTACT_REQUESTS_STORE], 'readonly');
        const store = transaction.objectStore(CONTACT_REQUESTS_STORE);
        const index = store.index('status');

        const request = index.getAll('pending');

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      });
    } catch (error) {
      throw new Error(`Failed to get pending contact requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getIncomingContactRequests(): Promise<ContactRequest[]> {
    try {
      const pendingRequests = await this.getPendingContactRequests();
      return pendingRequests.filter(request => request.type === 'incoming');
    } catch (error) {
      throw new Error(`Failed to get incoming contact requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOutgoingContactRequests(): Promise<ContactRequest[]> {
    try {
      const pendingRequests = await this.getPendingContactRequests();
      return pendingRequests.filter(request => request.type === 'outgoing');
    } catch (error) {
      throw new Error(`Failed to get outgoing contact requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllContactRequests(): Promise<ContactRequest[]> {
    try {
      const db = await openInviteDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONTACT_REQUESTS_STORE], 'readonly');
        const store = transaction.objectStore(CONTACT_REQUESTS_STORE);

        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      });
    } catch (error) {
      throw new Error(`Failed to get all contact requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getContactRequestsByStatus(status: ContactRequestStatus): Promise<ContactRequest[]> {
    try {
      const db = await openInviteDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONTACT_REQUESTS_STORE], 'readonly');
        const store = transaction.objectStore(CONTACT_REQUESTS_STORE);
        const index = store.index('status');

        const request = index.getAll(status);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      });
    } catch (error) {
      throw new Error(`Failed to get contact requests by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanupExpiredContactRequests(): Promise<number> {
    try {
      const allRequests = await this.getAllContactRequests();
      const now = new Date();
      let cleanedCount = 0;

      for (const request of allRequests) {
        if (request.expiresAt && request.expiresAt < now && request.status === 'pending') {
          await this.updateContactRequestStatus(request.id, 'expired');
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      throw new Error(`Failed to cleanup expired contact requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async bulkSendContactRequests(requests: OutgoingContactRequest[]): Promise<{ successful: number; failed: number; errors: string[] }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const request of requests) {
      try {
        await this.sendContactRequest(request);
        result.successful++;

        // Rate limiting to avoid overwhelming the system
        await delay(IMPORT_RATE_LIMIT_MS);
      } catch (error) {
        result.failed++;
        result.errors.push(`Failed to send request to ${request.recipientPublicKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  // Import/Export
  async importContacts(contactData: NostrContactList): Promise<ImportResult> {
    try {
      // Validate input
      if (!contactData || !Array.isArray(contactData.contacts)) {
        throw new Error('Invalid contact data format');
      }

      const result: ImportResult = {
        totalContacts: contactData.contacts.length,
        successfulImports: 0,
        failedImports: 0,
        duplicates: 0,
        errors: []
      };

      // Get existing contacts for deduplication
      const existingContacts = await contactStore.getAllContacts();
      const existingPublicKeys = new Set(existingContacts.map(c => c.publicKey));

      // Process contacts in batches to avoid overwhelming the system
      const batchSize = Math.min(MAX_IMPORT_BATCH_SIZE, contactData.contacts.length);

      for (let i = 0; i < contactData.contacts.length; i += batchSize) {
        const batch = contactData.contacts.slice(i, i + batchSize);

        for (const contactInfo of batch) {
          try {
            // Validate public key format using InputValidator
            const pkValidation = InputValidator.validatePublicKey(contactInfo.publicKey);
            if (!pkValidation.isValid) {
              result.failedImports++;
              result.errors.push({
                publicKey: contactInfo.publicKey || 'unknown',
                error: pkValidation.error || 'Invalid public key',
                reason: 'invalid_key'
              });
              continue;
            }

            const normalizedPubkey = pkValidation.normalized!;

            // Check for duplicates
            if (existingPublicKeys.has(normalizedPubkey)) {
              result.duplicates++;
              continue;
            }

            // Validate and sanitize optional fields
            let displayName: string | undefined;
            if (contactInfo.petname) {
              const nameValidation = InputValidator.validateDisplayName(contactInfo.petname);
              if (nameValidation.isValid) {
                displayName = nameValidation.sanitized;
              }
            }

            let relayUrl: string | undefined;
            if (contactInfo.relayUrl) {
              const urlValidation = InputValidator.validateRelayUrl(contactInfo.relayUrl);
              if (urlValidation.isValid) {
                relayUrl = contactInfo.relayUrl;
              }
            }

            // Create contact
            const contact: Contact = {
              id: cryptoService.generateInviteId(),
              publicKey: normalizedPubkey,
              displayName: displayName || `User ${normalizedPubkey.slice(0, 8)}`,
              trustLevel: 'neutral',
              groups: [],
              addedAt: new Date(),
              metadata: {
                source: 'import',
                importedFrom: relayUrl
              }
            };

            await contactStore.addContact(contact);
            existingPublicKeys.add(normalizedPubkey); // Prevent duplicates within the same import
            result.successfulImports++;

            // Rate limiting to avoid overwhelming the system
            if (i < contactData.contacts.length - 1) {
              await delay(IMPORT_RATE_LIMIT_MS);
            }
          } catch (error) {
            result.failedImports++;
            result.errors.push({
              publicKey: contactInfo.publicKey || 'unknown',
              error: error instanceof Error ? error.message : 'Unknown error',
              reason: 'validation_failed'
            });
          }
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Contact import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportContacts(): Promise<NostrContactList> {
    try {
      const contacts = await contactStore.getAllContacts();

      const exportData: NostrContactList = {
        contacts: contacts
          .filter(contact => contact.trustLevel !== 'blocked') // Don't export blocked contacts
          .map(contact => ({
            publicKey: contact.publicKey,
            petname: contact.displayName,
            relayUrl: contact.metadata.importedFrom
          })),
        version: 1,
        createdAt: Date.now()
      };

      return exportData;
    } catch (error) {
      throw new Error(`Contact export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateContactListFormat(data: any): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push('Data must be an object');
      return { isValid: false, errors };
    }

    if (!Array.isArray(data.contacts)) {
      errors.push('contacts field must be an array');
      return { isValid: false, errors };
    }

    if (typeof data.version !== 'number') {
      errors.push('version field must be a number');
    }

    if (typeof data.createdAt !== 'number') {
      errors.push('createdAt field must be a number');
    }

    // Validate each contact
    for (let i = 0; i < data.contacts.length; i++) {
      const contact = data.contacts[i];

      if (!contact || typeof contact !== 'object') {
        errors.push(`Contact at index ${i} must be an object`);
        continue;
      }

      if (!contact.publicKey || typeof contact.publicKey !== 'string') {
        errors.push(`Contact at index ${i} missing valid publicKey`);
        continue;
      }

      if (!cryptoService.isValidPubkey(contact.publicKey)) {
        errors.push(`Contact at index ${i} has invalid publicKey format`);
      }

      if (contact.petname && typeof contact.petname !== 'string') {
        errors.push(`Contact at index ${i} petname must be a string`);
      }

      if (contact.relayUrl && typeof contact.relayUrl !== 'string') {
        errors.push(`Contact at index ${i} relayUrl must be a string`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  async importContactsFromFile(fileContent: string): Promise<ImportResult> {
    try {
      // Parse JSON
      let contactData: any;
      try {
        contactData = JSON.parse(fileContent);
      } catch (error) {
        throw new Error('Invalid JSON format');
      }

      // Validate format
      const validation = await this.validateContactListFormat(contactData);
      if (!validation.isValid) {
        throw new Error(`Invalid contact list format: ${validation.errors.join(', ')}`);
      }

      // Import contacts
      return await this.importContacts(contactData as NostrContactList);
    } catch (error) {
      throw new Error(`File import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportContactsToFile(): Promise<string> {
    try {
      const contactData = await this.exportContacts();
      return JSON.stringify(contactData, null, 2);
    } catch (error) {
      throw new Error(`File export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods
  private async getCurrentUserIdentity(): Promise<{ publicKey: PublicKeyHex; privateKey: PrivateKeyHex }> {
    const identity = getIdentitySnapshot();

    if (identity.status !== 'unlocked' || !identity.publicKeyHex || !identity.privateKeyHex) {
      throw new Error('Identity is not unlocked. Please unlock your identity to continue.');
    }

    return {
      publicKey: identity.publicKeyHex,
      privateKey: identity.privateKeyHex
    };
  }

  private async generateUniqueShortCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const shortCode = generateRandomString(SHORT_CODE_LENGTH);

      // Check if this short code already exists
      const existing = await this.getInviteLinkByShortCode(shortCode);
      if (!existing) {
        return shortCode;
      }

      attempts++;
    }

    throw new Error('Failed to generate unique short code');
  }

  private extractShortCodeFromLink(linkData: string): string | null {
    try {
      // Handle both full URLs and just short codes
      if (linkData.includes('/')) {
        const parts = linkData.split('/');
        return parts[parts.length - 1];
      }
      return linkData;
    } catch {
      return null;
    }
  }

  private async storeContactRequest(contactRequest: ContactRequest): Promise<void> {
    // Check pending request limits
    await this.enforcePendingRequestLimits();

    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACT_REQUESTS_STORE);

      const request = store.add(contactRequest);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async storeInviteLink(inviteLink: InviteLink): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVITE_LINKS_STORE], 'readwrite');
      const store = transaction.objectStore(INVITE_LINKS_STORE);

      const request = store.add(inviteLink);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async getInviteLinkByShortCode(shortCode: string): Promise<InviteLink | null> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVITE_LINKS_STORE], 'readonly');
      const store = transaction.objectStore(INVITE_LINKS_STORE);
      const index = store.index('shortCode');

      const request = index.get(shortCode);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async incrementInviteLinkUsage(linkId: string): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([INVITE_LINKS_STORE], 'readwrite');
      const store = transaction.objectStore(INVITE_LINKS_STORE);

      const getRequest = store.get(linkId);

      getRequest.onsuccess = () => {
        const inviteLink = getRequest.result;
        if (inviteLink) {
          inviteLink.currentUses++;

          const putRequest = store.put(inviteLink);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
        } else {
          resolve(); // Link not found, but don't error
        }
      };

      getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async getContactRequest(requestId: string): Promise<ContactRequest | null> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_REQUESTS_STORE], 'readonly');
      const store = transaction.objectStore(CONTACT_REQUESTS_STORE);

      const request = store.get(requestId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async updateContactRequestStatus(requestId: string, status: ContactRequestStatus): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACT_REQUESTS_STORE);

      const getRequest = store.get(requestId);

      getRequest.onsuccess = () => {
        const contactRequest = getRequest.result;
        if (!contactRequest) {
          reject(new Error('Contact request not found'));
          return;
        }

        contactRequest.status = status;

        const putRequest = store.put(contactRequest);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      };

      getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async findContactByPublicKey(publicKey: PublicKeyHex): Promise<Contact | null> {
    try {
      const contacts = await contactStore.getAllContacts();
      return contacts.find(contact => contact.publicKey === publicKey) || null;
    } catch {
      return null;
    }
  }

  private async enforcePendingRequestLimits(): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONTACT_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONTACT_REQUESTS_STORE);
      const index = store.index('status');

      const request = index.getAll('pending');

      request.onsuccess = () => {
        const pendingRequests = request.result || [];

        if (pendingRequests.length >= MAX_PENDING_REQUESTS) {
          // Sort by creation date and remove oldest
          pendingRequests.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

          const toRemove = pendingRequests.slice(0, pendingRequests.length - MAX_PENDING_REQUESTS + 1);

          let completed = 0;
          for (const oldRequest of toRemove) {
            const deleteRequest = store.delete(oldRequest.id);
            deleteRequest.onsuccess = () => {
              completed++;
              if (completed === toRemove.length) {
                resolve();
              }
            };
            deleteRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
          }

          if (toRemove.length === 0) {
            resolve();
          }
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private validateAndSanitizeDisplayName(name?: string): string | undefined {
    if (!name || typeof name !== 'string') {
      return undefined;
    }

    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      return undefined;
    }

    // Basic sanitization - remove potentially harmful characters
    return trimmed.replace(/[<>]/g, '');
  }

  private validateRelayUrl(url?: string): string | undefined {
    if (!url || typeof url !== 'string') {
      return undefined;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') {
        return url;
      }
    } catch {
      // Invalid URL
    }

    return undefined;
  }
}

/**
 * Singleton invite manager instance
 */
export const inviteManager: InviteManager = new InviteManagerImpl();

/**
 * Hook for using invite manager in React components
 */
export const useInviteManager = (): InviteManager => {
  return inviteManager;
};