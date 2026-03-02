import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import {
  QRInviteOptions,
  InviteLinkOptions,
  QRInviteData,
  QRCode,
  ConnectionRequest,
  OutgoingConnectionRequest,
  Connection,
  ConnectionGroup,
  ConnectionFilter,
  TrustLevel,
  UserProfile,
  PrivacySettings,
  ShareableProfile,
  InviteLink,
  ImportResult,
  NostrConnectionList,
  ConnectionRequestStatus
} from './types';
import type { DeepLinkResult } from './deep-link-handler';

/**
 * Central orchestrator for all invite-related operations
 */
export interface InviteManager {
  // QR Code Operations
  generateQRInvite(options: QRInviteOptions): Promise<QRInviteData>;
  processQRInvite(qrData: string): Promise<ConnectionRequest>;

  // Link Operations  
  generateInviteLink(options: InviteLinkOptions): Promise<InviteLink>;
  processInviteLink(linkData: string): Promise<ConnectionRequest>;
  generateGroupInviteUrl(groupId: string): string;
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
  handleUrlScheme(url: string): Promise<ConnectionRequest | null>;

  // Connection Request Management
  sendConnectionRequest(request: OutgoingConnectionRequest): Promise<void>;
  acceptConnectionRequest(requestId: string): Promise<Connection>;
  declineConnectionRequest(requestId: string, block?: boolean): Promise<void>;
  cancelConnectionRequest(requestId: string): Promise<void>;
  getPendingConnectionRequests(): Promise<ConnectionRequest[]>;
  getIncomingConnectionRequests(): Promise<ConnectionRequest[]>;
  getOutgoingConnectionRequests(): Promise<ConnectionRequest[]>;
  getAllConnectionRequests(): Promise<ConnectionRequest[]>;
  getConnectionRequestsByStatus(status: ConnectionRequestStatus): Promise<ConnectionRequest[]>;

  // Import/Export
  importConnections(connectionData: NostrConnectionList): Promise<ImportResult>;
  exportConnections(): Promise<NostrConnectionList>;
  validateConnectionListFormat(data: unknown): Promise<Readonly<{ isValid: boolean; errors: ReadonlyArray<string> }>>;
  importConnectionsFromFile(fileContent: string): Promise<ImportResult>;
  exportConnectionsToFile(): Promise<string>;
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
 * Manages connection data, organization, and persistence
 */
export interface ConnectionStore {
  // Connection Management
  addConnection(connection: Connection): Promise<void>;
  updateConnection(connectionId: string, updates: Partial<Connection>): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  getConnection(connectionId: string): Promise<Connection | null>;
  getAllConnections(): Promise<Connection[]>;

  // Connection Organization
  createGroup(group: ConnectionGroup): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
  getGroup(groupId: string): Promise<ConnectionGroup | null>;
  getAllGroups(): Promise<ConnectionGroup[]>;
  updateGroup(groupId: string, updates: Partial<ConnectionGroup>): Promise<void>;
  addConnectionToGroup(connectionId: string, groupId: string): Promise<void>;
  removeConnectionFromGroup(connectionId: string, groupId: string): Promise<void>;
  getConnectionsByGroup(groupId: string): Promise<Connection[]>;

  // Search and Filtering
  searchConnections(query: string): Promise<Connection[]>;
  filterConnections(filter: ConnectionFilter): Promise<Connection[]>;

  // Trust Management
  setTrustLevel(connectionId: string, level: TrustLevel): Promise<void>;
  getTrustedConnections(): Promise<Connection[]>;
  getBlockedConnections(): Promise<Connection[]>;
  getNeutralConnections(): Promise<Connection[]>;
  getConnectionsByTrustLevel(level: TrustLevel): Promise<Connection[]>;
  bulkSetTrustLevel(connectionIds: string[], level: TrustLevel): Promise<void>;

  // Multi-group operations
  addConnectionToMultipleGroups(connectionId: string, groupIds: string[]): Promise<void>;
  removeConnectionFromMultipleGroups(connectionId: string, groupIds: string[]): Promise<void>;

  // Public key lookup
  getConnectionByPublicKey(publicKey: string): Promise<Connection | null>;
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
  validateProfileData(profile: ShareableProfile): Promise<boolean>;
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