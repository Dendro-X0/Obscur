import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';

// Core invite system types
export type TrustLevel = "trusted" | "neutral" | "blocked";

export type ConnectionRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export interface QRInviteOptions {
  displayName?: string;
  avatar?: string;
  message?: string;
  expirationHours?: number;
  includeProfile?: boolean;
}

export interface InviteLinkOptions {
  displayName?: string;
  avatar?: string;
  message?: string;
  expirationTime?: Date;
  maxUses?: number;
  includeProfile?: boolean;
}

export interface QRInviteData {
  version: string;
  publicKey: PublicKeyHex;
  displayName?: string;
  avatar?: string;
  message?: string;
  timestamp: number;
  expirationTime: number;
  signature: string;
}

export interface QRCode {
  dataUrl: string;
  svgString: string;
  rawData: string;
  size: number;
}

export interface Connection {
  id: string;
  publicKey: PublicKeyHex;
  displayName: string;
  avatar?: string;
  bio?: string;
  trustLevel: TrustLevel;
  groups: string[];
  addedAt: Date;
  lastSeen?: Date;
  metadata: ConnectionMetadata;
}

export interface ConnectionMetadata {
  source?: 'qr' | 'link' | 'import' | 'manual';
  importedFrom?: string;
  notes?: string;
}

export interface ConnectionGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: Date;
}

export interface ConnectionFilter {
  trustLevel?: TrustLevel;
  groups?: string[];
  searchQuery?: string;
  addedAfter?: Date;
  addedBefore?: Date;
}

export interface ConnectionRequest {
  id: string;
  type: "incoming" | "outgoing";
  senderPublicKey: PublicKeyHex;
  recipientPublicKey: PublicKeyHex;
  profile: ShareableProfile;
  message?: string;
  status: ConnectionRequestStatus;
  createdAt: Date;
  expiresAt?: Date;
}

export interface OutgoingConnectionRequest {
  recipientPublicKey: PublicKeyHex;
  message?: string;
  includeProfile: boolean;
}

export interface InviteLink {
  id: string;
  url: string;
  shortCode: string;
  createdBy: PublicKeyHex;
  profile: ShareableProfile;
  message?: string;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
  createdAt: Date;
}

export interface UserProfile {
  displayName: string;
  avatar?: string;
  bio?: string;
  website?: string;
  nip05?: string;
  lud16?: string;
}

export interface PrivacySettings {
  shareDisplayName: boolean;
  shareAvatar: boolean;
  shareBio: boolean;
  shareWebsite: boolean;
  allowConnectionRequests: boolean;
  requireMessage: boolean;
  autoAcceptTrusted: boolean;
}

export interface ShareableProfile {
  displayName?: string;
  avatar?: string;
  bio?: string;
  publicKey: PublicKeyHex;
  timestamp: number;
  signature: string;
}

export interface ImportResult {
  totalConnections: number;
  successfulImports: number;
  failedImports: number;
  duplicates: number;
  errors: ImportError[];
}

export interface ImportError {
  publicKey: string;
  error: string;
  reason: "invalid_key" | "already_exists" | "network_error" | "validation_failed";
}

export interface NostrConnectionList {
  connections: Array<{
    publicKey: PublicKeyHex;
    relayUrl?: string;
    petname?: string;
  }>;
  version: number;
  createdAt: number;
}