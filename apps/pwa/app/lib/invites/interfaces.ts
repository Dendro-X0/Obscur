import { PublicKeyHex, PrivateKeyHex } from '@dweb/crypto';
import {
  QRInviteOptions,
  InviteLinkOptions,
  QRInviteData,
  QRCode,
  ContactRequest,
  OutgoingContactRequest,
  Contact,
  ContactGroup,
  ContactFilter,
  TrustLevel,
  UserProfile,
  PrivacySettings,
  ShareableProfile,
  InviteLink,
  ImportResult,
  NostrContactList
} from './types';
import type { DeepLinkResult } from './deep-link-handler';

/**
 * Central orchestrator for all invite-related operations
 */
export interface InviteManager {
  // QR Code Operations
  generateQRInvite(options: QRInviteOptions): Promise<QRInviteData>;
  processQRInvite(qrData: string): Promise<ContactRequest>;
  
  // Link Operations  
  generateInviteLink(options: InviteLinkOptions): Promise<InviteLink>;
  processInviteLink(linkData: string): Promise<ContactRequest>;
  revokeInviteLink(linkId: string): Promise<void>;
  
  // Cross-platform compatibility operations
  generateUniversalInviteLink(options: InviteLinkOptions): Promise<{ 
    inviteLink: InviteLink; 
    universalLink: string; 
    fallbackUrl: string; 
    appScheme: string; 
  }>;
  generateNostrCompatibleQR(options: QRInviteOptions): Promise<{
    qrData: QRInviteData;
    formats: {
      obscur: string;
      nostr: string;
      universal: string;
    };
  }>;
  
  // Deep link processing operations
  processDeepLink(url: string): Promise<DeepLinkResult>;
  handleUrlScheme(url: string): Promise<ContactRequest | null>;
  
  // Contact Request Management
  sendContactRequest(request: OutgoingContactRequest): Promise<void>;
  acceptContactRequest(requestId: string): Promise<Contact>;
  declineContactRequest(requestId: string, block?: boolean): Promise<void>;
  cancelContactRequest(requestId: string): Promise<void>;
  
  // Import/Export
  importContacts(contactData: NostrContactList): Promise<ImportResult>;
  exportContacts(): Promise<NostrContactList>;
}

/**
 * Handles QR code generation and scanning with security features
 */
export interface QRGenerator {
  generateQR(data: QRInviteData): Promise<QRCode>;
  scanQR(imageData: ImageData): Promise<QRInviteData>;
  validateQRData(data: string): boolean;
}

/**
 * Manages contact data, organization, and persistence
 */
export interface ContactStore {
  // Contact Management
  addContact(contact: Contact): Promise<void>;
  updateContact(contactId: string, updates: Partial<Contact>): Promise<void>;
  removeContact(contactId: string): Promise<void>;
  getContact(contactId: string): Promise<Contact | null>;
  getAllContacts(): Promise<Contact[]>;
  
  // Contact Organization
  createGroup(group: ContactGroup): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  getGroup(groupId: string): Promise<ContactGroup | null>;
  getAllGroups(): Promise<ContactGroup[]>;
  updateGroup(groupId: string, updates: Partial<ContactGroup>): Promise<void>;
  addContactToGroup(contactId: string, groupId: string): Promise<void>;
  removeContactFromGroup(contactId: string, groupId: string): Promise<void>;
  getContactsByGroup(groupId: string): Promise<Contact[]>;
  
  // Search and Filtering
  searchContacts(query: string): Promise<Contact[]>;
  filterContacts(filter: ContactFilter): Promise<Contact[]>;
  
  // Trust Management
  setTrustLevel(contactId: string, level: TrustLevel): Promise<void>;
  getTrustedContacts(): Promise<Contact[]>;
  getBlockedContacts(): Promise<Contact[]>;
  getNeutralContacts(): Promise<Contact[]>;
  getContactsByTrustLevel(level: TrustLevel): Promise<Contact[]>;
  bulkSetTrustLevel(contactIds: string[], level: TrustLevel): Promise<void>;
  
  // Multi-group operations
  addContactToMultipleGroups(contactId: string, groupIds: string[]): Promise<void>;
  removeContactFromMultipleGroups(contactId: string, groupIds: string[]): Promise<void>;
}

/**
 * Manages user profile information and privacy settings
 */
export interface ProfileManager {
  // Profile Management
  updateProfile(profile: UserProfile): Promise<void>;
  getProfile(): Promise<UserProfile>;
  
  // Privacy Controls
  updatePrivacySettings(settings: PrivacySettings): Promise<void>;
  getPrivacySettings(): Promise<PrivacySettings>;
  applyPrivacySettingsToFutureInvites(settings: PrivacySettings): Promise<void>;
  getGranularPrivacyControls(): Promise<{
    displayName: boolean;
    avatar: boolean;
    bio: boolean;
    website: boolean;
  }>;
  updateFieldPrivacy(field: 'displayName' | 'avatar' | 'bio' | 'website', share: boolean): Promise<void>;
  shouldShareField(field: 'displayName' | 'avatar' | 'bio' | 'website'): Promise<boolean>;
  
  // Shareable Profile
  getShareableProfile(publicKey: PublicKeyHex, privateKey: PrivateKeyHex): Promise<ShareableProfile>;
  validateProfileData(profile: ShareableProfile): boolean;
}

/**
 * Crypto service extensions for invite-specific operations
 */
export interface InviteCryptoService {
  // Signature operations for invite data
  signInviteData(data: object): Promise<string>;
  verifyInviteSignature(data: object, signature: string, publicKey: PublicKeyHex): Promise<boolean>;
  
  // Secure random data generation
  generateInviteId(): Promise<string>;
  generateShortCode(): Promise<string>;
  
  // Encryption for sensitive invite information
  encryptInviteData(data: string, publicKey: PublicKeyHex): Promise<string>;
  decryptInviteData(encryptedData: string): Promise<string>;
}