import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import type {
  InviteManager,
} from './interfaces';

import type {
  QRInviteOptions,
  InviteLinkOptions,
  QRInviteData,
  ConnectionRequest,
  OutgoingConnectionRequest,
  Connection,
  InviteLink,
  ImportResult,
  NostrConnectionList,
  ConnectionRequestStatus,
  ShareableProfile
} from './types';
import { cryptoService } from '../../crypto/crypto-service';
import { qrGenerator } from './qr-generator';
import { connectionStore } from './connection-store';
import { profileManager } from './profile-manager';
import { openInviteDb } from './db/open-invite-db';
import { getIdentitySnapshot } from '../../auth/hooks/use-identity';
import {
  CONNECTION_REQUESTS_STORE,
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
import {
  connectionSearchIndex
} from './performance-optimizations';
import { NostrCompatibilityService } from './nostr-compatibility';
import { DeepLinkHandler } from './deep-link-handler';
import {
  InputValidator,
  SecureStorage,
  canGenerateQR,
  canGenerateInviteLink,
  canSendConnectionRequest,
  canProcessInvite
} from './security-enhancements';
import { logAppEvent } from '@/app/shared/log-app-event';
import { publishToUrlsStandalone } from '../../relays/hooks/enhanced-relay-pool';

type CoordinationInviteCreateResponse = Readonly<{
  inviteId: string;
  token: string;
  relays: ReadonlyArray<string>;
  expiresAtUnixSeconds: number | null;
}>;

type CoordinationInviteRedeemResponse = Readonly<{
  inviteId: string;
  inviterPubkey: string;
  communityLabel: string | null;
  relays: ReadonlyArray<string>;
  expiresAtUnixSeconds: number | null;
}>;

type CoordinationOkResponse<T> = Readonly<{
  ok: true;
  data: T;
}>;

type CoordinationErrorResponse = Readonly<{
  ok: false;
  error: string;
}>;

type CoordinationResponse<T> = CoordinationOkResponse<T> | CoordinationErrorResponse;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const parseNostrConnectionList = (value: unknown): NostrConnectionList | null => {
  if (!isRecord(value)) {
    return null;
  }
  const connections: unknown = value.connections;
  const version: unknown = value.version;
  const createdAt: unknown = value.createdAt;
  if (!Array.isArray(connections) || !isNumber(version) || !isNumber(createdAt)) {
    return null;
  }

  const parsedConnections: Array<{ publicKey: PublicKeyHex; relayUrl?: string; petname?: string }> = connections
    .map((candidate: unknown): { publicKey: PublicKeyHex; relayUrl?: string; petname?: string } | null => {
      if (!isRecord(candidate)) {
        return null;
      }
      const publicKey: unknown = candidate.publicKey;
      const relayUrl: unknown = candidate.relayUrl;
      const petname: unknown = candidate.petname;
      if (!isString(publicKey) || !cryptoService.isValidPubkey(publicKey)) {
        return null;
      }
      const relayUrlOut: string | undefined = isString(relayUrl) && relayUrl.trim().length > 0 ? relayUrl.trim() : undefined;
      const petnameOut: string | undefined = isString(petname) && petname.trim().length > 0 ? petname.trim() : undefined;
      return { publicKey: publicKey as PublicKeyHex, relayUrl: relayUrlOut, petname: petnameOut };
    })
    .filter((connection: { publicKey: PublicKeyHex; relayUrl?: string; petname?: string } | null): connection is { publicKey: PublicKeyHex; relayUrl?: string; petname?: string } => connection !== null);
  return { connections: parsedConnections, version: version as number, createdAt: createdAt as number };
};

const getCoordinationBaseUrl = (): string | null => {
  const raw: string = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  return null;
};

const getRelayListStorageKey = (publicKeyHex: string): string => {
  return `obscur.relay_list.v1.${publicKeyHex}`;
};

const getEnabledRelayUrlsForIdentity = (publicKeyHex: string): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw: string | null = window.localStorage.getItem(getRelayListStorageKey(publicKeyHex));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const urls: string[] = parsed
      .map((item: unknown): string | null => {
        if (!isRecord(item)) {
          return null;
        }
        const url: unknown = item.url;
        const enabled: unknown = item.enabled;
        if (typeof url !== "string") {
          return null;
        }
        if (enabled === false) {
          return null;
        }
        const normalized: string = url.trim();
        return normalized.length > 0 ? normalized : null;
      })
      .filter((u: string | null): u is string => u !== null);
    return Array.from(new Set(urls));
  } catch {
    return [];
  }
};

const parseCoordinationResponse = <T>(value: unknown): CoordinationResponse<T> | null => {
  if (!isRecord(value)) {
    return null;
  }
  const ok: unknown = value.ok;
  if (ok === true) {
    return value as CoordinationOkResponse<T>;
  }
  if (ok === false) {
    return value as CoordinationErrorResponse;
  }
  return null;
};

const coordinationCreateInvite = async (params: Readonly<{ inviterPubkey: string; relays: ReadonlyArray<string>; ttlSeconds?: number }>): Promise<CoordinationInviteCreateResponse> => {
  const baseUrl: string | null = getCoordinationBaseUrl();
  if (!baseUrl) {
    throw new Error("coordination_not_configured");
  }
  logAppEvent({
    name: "coordination.invite.create.start",
    level: "info",
    scope: { feature: "invites", action: "create" },
    context: { relaysCount: params.relays.length, hasTtlSeconds: params.ttlSeconds !== undefined }
  });
  const response = await fetch(`${baseUrl}/invites/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inviterPubkey: params.inviterPubkey, relays: params.relays, ttlSeconds: params.ttlSeconds })
  });
  const raw: unknown = await response.json().catch((): null => null);
  const parsed: CoordinationResponse<CoordinationInviteCreateResponse> | null = parseCoordinationResponse<CoordinationInviteCreateResponse>(raw);
  if (!parsed) {
    logAppEvent({
      name: "coordination.invite.create.failure",
      level: "error",
      scope: { feature: "invites", action: "create" },
      context: { relaysCount: params.relays.length, hasTtlSeconds: params.ttlSeconds !== undefined }
    });
    throw new Error("coordination_invalid_response");
  }
  if (!parsed.ok) {
    logAppEvent({
      name: "coordination.invite.create.failure",
      level: "error",
      scope: { feature: "invites", action: "create" },
      context: { relaysCount: params.relays.length, hasTtlSeconds: params.ttlSeconds !== undefined, error: parsed.error }
    });
    throw new Error(parsed.error);
  }
  logAppEvent({
    name: "coordination.invite.create.success",
    level: "info",
    scope: { feature: "invites", action: "create" },
    context: { relaysCount: parsed.data.relays.length, hasExpiresAt: parsed.data.expiresAtUnixSeconds !== null }
  });
  return parsed.data;
};

const coordinationRedeemInvite = async (params: Readonly<{ token: string; redeemerPubkey: string }>): Promise<CoordinationInviteRedeemResponse> => {
  const baseUrl: string | null = getCoordinationBaseUrl();
  if (!baseUrl) {
    throw new Error("coordination_not_configured");
  }
  logAppEvent({
    name: "coordination.invite.redeem.start",
    level: "info",
    scope: { feature: "invites", action: "redeem" },
    context: { hasBaseUrl: true }
  });
  const response = await fetch(`${baseUrl}/invites/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: params.token, redeemerPubkey: params.redeemerPubkey })
  });
  const raw: unknown = await response.json().catch((): null => null);
  const parsed: CoordinationResponse<CoordinationInviteRedeemResponse> | null = parseCoordinationResponse<CoordinationInviteRedeemResponse>(raw);
  if (!parsed) {
    logAppEvent({
      name: "coordination.invite.redeem.failure",
      level: "error",
      scope: { feature: "invites", action: "redeem" },
      context: { hasBaseUrl: true }
    });
    throw new Error("coordination_invalid_response");
  }
  if (!parsed.ok) {
    logAppEvent({
      name: "coordination.invite.redeem.failure",
      level: "error",
      scope: { feature: "invites", action: "redeem" },
      context: { hasBaseUrl: true, error: parsed.error }
    });
    throw new Error(parsed.error);
  }
  logAppEvent({
    name: "coordination.invite.redeem.success",
    level: "info",
    scope: { feature: "invites", action: "redeem" },
    context: { relaysCount: parsed.data.relays.length }
  });
  return parsed.data;
};

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

      const inviteId: string = await cryptoService.generateInviteId();

      // Create invite data structure
      const inviteData = {
        publicKey: identity.publicKey,
        displayName: options.includeProfile ? options.displayName : undefined,
        avatar: options.includeProfile ? options.avatar : undefined,
        message: options.message,
        timestamp: now,
        expirationTime,
        inviteId
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

  async processQRInvite(qrData: string): Promise<ConnectionRequest> {
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
      const pkValidation = await InputValidator.validatePublicKey(parsedData.publicKey);
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

      // Create connection request
      const connectionRequest: ConnectionRequest = {
        id: await cryptoService.generateInviteId(),
        type: 'incoming',
        senderPublicKey: parsedData.publicKey,
        recipientPublicKey: identity.publicKey,
        profile: shareableProfile,
        message: parsedData.message,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(parsedData.expirationTime)
      };

      // Store the connection request
      await this.storeConnectionRequest(connectionRequest);

      return connectionRequest;
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

      const enabledRelayUrls: ReadonlyArray<string> = getEnabledRelayUrlsForIdentity(identity.publicKey);
      const ttlSeconds: number | undefined = options.expirationTime ? Math.max(60, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)) : undefined;
      let shortCode: string;
      try {
        const created = await coordinationCreateInvite({ inviterPubkey: identity.publicKey, relays: enabledRelayUrls, ttlSeconds });
        shortCode = created.token;
      } catch (error) {
        const message: string = error instanceof Error ? error.message : "coordination_create_failed";
        logAppEvent({
          name: "coordination.invite.create.fallback_used",
          level: "warn",
          scope: { feature: "invites", action: "create" },
          context: { relaysCount: enabledRelayUrls.length, error: message }
        });
        // Generate unique short code (legacy local-only flow)
        shortCode = await this.generateUniqueShortCode();
      }

      // Create invite link
      const inviteLink: InviteLink = {
        id: await cryptoService.generateInviteId(),
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
      const inviteLink = await this.generateInviteLink(options);
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
      const qrData = await this.generateQRInvite(options);
      const formats = NostrCompatibilityService.generateCompatibleQRData(qrData);
      return { qrData, formats };
    } catch (error) {
      throw new Error(`Nostr-compatible QR generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  generateGroupInviteUrl(groupId: string): string {
    return `${INVITE_LINK_BASE_URL.replace('/invite', '/group')}/${groupId}`;
  }

  async processInviteLink(linkData: string): Promise<ConnectionRequest> {
    try {
      // Check if this is a deep link URL that needs parsing
      if (linkData.includes('://') || linkData.includes('nostr:')) {
        const deepLinkResult = await DeepLinkHandler.processDeepLink(linkData);
        if (deepLinkResult.success && deepLinkResult.connectionRequest) {
          return deepLinkResult.connectionRequest;
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
        const identity = await this.getCurrentUserIdentity();
        const redeemed = await coordinationRedeemInvite({ token: shortCode, redeemerPubkey: identity.publicKey });
        const senderPublicKey: string = redeemed.inviterPubkey;
        const connectionRequest: ConnectionRequest = {
          id: await cryptoService.generateInviteId(),
          type: 'incoming',
          senderPublicKey: senderPublicKey as PublicKeyHex,
          recipientPublicKey: identity.publicKey,
          profile: {
            publicKey: senderPublicKey as PublicKeyHex,
            timestamp: Date.now(),
            signature: ""
          },
          status: 'pending',
          createdAt: new Date(),
          expiresAt: redeemed.expiresAtUnixSeconds ? new Date(redeemed.expiresAtUnixSeconds * 1000) : undefined
        };
        await this.storeConnectionRequest(connectionRequest);
        return connectionRequest;
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

      // Create connection request
      const connectionRequest: ConnectionRequest = {
        id: await cryptoService.generateInviteId(),
        type: 'incoming',
        senderPublicKey: inviteLink.createdBy,
        recipientPublicKey: identity.publicKey,
        profile: inviteLink.profile,
        message: inviteLink.message,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: inviteLink.expiresAt
      };

      // Store the connection request
      await this.storeConnectionRequest(connectionRequest);

      // Increment usage count
      await this.incrementInviteLinkUsage(inviteLink.id);

      return connectionRequest;
    } catch (error) {
      throw new Error(`Invite link processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async processDeepLink(url: string): Promise<import('./deep-link-handler').DeepLinkResult> {
    try {
      return await DeepLinkHandler.processDeepLink(url);
    } catch (error) {
      throw new Error(`Deep link processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async handleUrlScheme(url: string): Promise<ConnectionRequest | null> {
    try {
      const result = await this.processDeepLink(url);
      if (result.success && result.connectionRequest) {
        return result.connectionRequest;
      }
      if (result.fallbackAction) {
        throw new Error(`Deep link failed: ${result.error}. Fallback action: ${result.fallbackAction}`);
      }
      return null;
    } catch (error) {
      throw new Error(`URL scheme handling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  // Connection Request Management
  async sendConnectionRequest(request: OutgoingConnectionRequest): Promise<void> {
    try {
      // Get current user identity
      const identity = await this.getCurrentUserIdentity();

      // Rate limiting check
      if (!canSendConnectionRequest(identity.publicKey)) {
        throw new Error('Rate limit exceeded for connection requests. Please try again later.');
      }

      // Validate recipient public key
      const pkValidation = await InputValidator.validatePublicKey(request.recipientPublicKey);
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

      // Create connection request
      const connectionRequest: ConnectionRequest = {
        id: await cryptoService.generateInviteId(),
        type: 'outgoing',
        senderPublicKey: identity.publicKey,
        recipientPublicKey: request.recipientPublicKey,
        profile: shareableProfile,
        message: request.message,
        status: 'pending',
        createdAt: new Date()
      };

      // Store the connection request
      await this.storeConnectionRequest(connectionRequest);

      // 5) Send the connection request via Nostr relay
      const event = await NostrCompatibilityService.createInviteRequestEvent(
        identity.privateKey,
        request.recipientPublicKey,
        shareableProfile,
        request.message
      );

      const targetRelays = getEnabledRelayUrlsForIdentity(identity.publicKey);
      if (targetRelays.length > 0) {
        logAppEvent({
          name: "invites.send_request.publishing",
          level: "info",
          scope: { feature: "invites", action: "send" },
          context: { relaysCount: targetRelays.length, eventId: event.id }
        });

        await publishToUrlsStandalone(targetRelays, JSON.stringify(["EVENT", event]));
      }
    } catch (error) {
      throw new Error(`Connection request sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async acceptConnectionRequest(requestId: string): Promise<Connection> {
    try {
      // Get the connection request
      const connectionRequest = await this.getConnectionRequest(requestId);
      if (!connectionRequest) {
        throw new Error('Connection request not found');
      }

      if (connectionRequest.status !== 'pending') {
        throw new Error('Connection request is not pending');
      }

      // Create connection from the request
      const connection: Connection = {
        id: await cryptoService.generateInviteId(),
        publicKey: connectionRequest.senderPublicKey,
        displayName: connectionRequest.profile.displayName || `User ${connectionRequest.senderPublicKey.slice(0, 8)}`,
        avatar: connectionRequest.profile.avatar,
        bio: connectionRequest.profile.bio,
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: {
          source: 'qr', // This could be 'qr' or 'link' depending on how the request was created
          notes: connectionRequest.message
        }
      };

      // Add connection to store
      await connectionStore.addConnection(connection);

      // Update connection request status
      await this.updateConnectionRequestStatus(requestId, 'accepted');

      return connection;
    } catch (error) {
      throw new Error(`Connection request acceptance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async declineConnectionRequest(requestId: string, block?: boolean): Promise<void> {
    try {
      // Get the connection request
      const connectionRequest = await this.getConnectionRequest(requestId);
      if (!connectionRequest) {
        throw new Error('Connection request not found');
      }

      if (connectionRequest.status !== 'pending') {
        throw new Error('Connection request is not pending');
      }

      // Update connection request status
      await this.updateConnectionRequestStatus(requestId, 'declined');

      // If blocking is requested, add to blocked connections
      if (block) {
        const blockedConnection: Connection = {
          id: await cryptoService.generateInviteId(),
          publicKey: connectionRequest.senderPublicKey,
          displayName: `Blocked ${connectionRequest.senderPublicKey.slice(0, 8)}`,
          trustLevel: 'blocked',
          groups: [],
          addedAt: new Date(),
          metadata: {
            source: 'qr',
            notes: 'Blocked from connection request'
          }
        };

        await connectionStore.addConnection(blockedConnection);
      }
    } catch (error) {
      throw new Error(`Connection request decline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelConnectionRequest(requestId: string): Promise<void> {
    try {
      // Get the connection request
      const connectionRequest = await this.getConnectionRequest(requestId);
      if (!connectionRequest) {
        throw new Error('Connection request not found');
      }

      if (connectionRequest.type !== 'outgoing') {
        throw new Error('Can only cancel outgoing connection requests');
      }

      if (connectionRequest.status !== 'pending') {
        throw new Error('Connection request is not pending');
      }

      // Update connection request status
      await this.updateConnectionRequestStatus(requestId, 'cancelled');
    } catch (error) {
      throw new Error(`Connection request cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Additional Connection Request Management Methods
  async getPendingConnectionRequests(): Promise<ConnectionRequest[]> {
    try {
      const db = await openInviteDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONNECTION_REQUESTS_STORE], 'readonly');
        const store = transaction.objectStore(CONNECTION_REQUESTS_STORE);
        const index = store.index('status');

        const request = index.getAll('pending');

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      });
    } catch (error) {
      throw new Error(`Failed to get pending connection requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getIncomingConnectionRequests(): Promise<ConnectionRequest[]> {
    try {
      const pendingRequests = await this.getPendingConnectionRequests();
      return pendingRequests.filter(request => request.type === 'incoming');
    } catch (error) {
      throw new Error(`Failed to get incoming connection requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOutgoingConnectionRequests(): Promise<ConnectionRequest[]> {
    try {
      const pendingRequests = await this.getPendingConnectionRequests();
      return pendingRequests.filter(request => request.type === 'outgoing');
    } catch (error) {
      throw new Error(`Failed to get outgoing connection requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllConnectionRequests(): Promise<ConnectionRequest[]> {
    try {
      const db = await openInviteDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONNECTION_REQUESTS_STORE], 'readonly');
        const store = transaction.objectStore(CONNECTION_REQUESTS_STORE);

        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      });
    } catch (error) {
      throw new Error(`Failed to get all connection requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConnectionRequestsByStatus(status: ConnectionRequestStatus): Promise<ConnectionRequest[]> {
    try {
      const db = await openInviteDb();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONNECTION_REQUESTS_STORE], 'readonly');
        const store = transaction.objectStore(CONNECTION_REQUESTS_STORE);
        const index = store.index('status');

        const request = index.getAll(status);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      });
    } catch (error) {
      throw new Error(`Failed to get connection requests by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanupExpiredConnectionRequests(): Promise<number> {
    try {
      const allRequests = await this.getAllConnectionRequests();
      const now = new Date();
      let cleanedCount = 0;

      for (const request of allRequests) {
        if (request.expiresAt && request.expiresAt < now && request.status === 'pending') {
          await this.updateConnectionRequestStatus(request.id, 'expired');
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      throw new Error(`Failed to cleanup expired connection requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async bulkSendConnectionRequests(requests: OutgoingConnectionRequest[]): Promise<{ successful: number; failed: number; errors: string[] }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const request of requests) {
      try {
        await this.sendConnectionRequest(request);
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
  async importConnections(connectionData: NostrConnectionList): Promise<ImportResult> {
    try {
      const result: ImportResult = {
        totalConnections: connectionData.connections.length,
        successfulImports: 0,
        failedImports: 0,
        duplicates: 0,
        errors: []
      };

      // Get existing connections for deduplication
      const existingConnections = await connectionStore.getAllConnections();
      const existingPublicKeys = new Set(existingConnections.map((connection: Connection) => connection.publicKey));

      // Ensure search index is populated
      connectionSearchIndex.rebuild(existingConnections);

      // Process connections in batches to avoid overwhelming the system
      for (let i = 0; i < connectionData.connections.length; i += MAX_IMPORT_BATCH_SIZE) {
        const batch = connectionData.connections.slice(i, i + MAX_IMPORT_BATCH_SIZE);

        for (const connectionInfo of batch) {
          try {
            // Validate public key format using InputValidator
            const pkValidation = await InputValidator.validatePublicKey(connectionInfo.publicKey);
            if (!pkValidation.isValid) {
              result.failedImports++;
              result.errors.push({
                publicKey: connectionInfo.publicKey || 'unknown',
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
            if (connectionInfo.petname) {
              const nameValidation = InputValidator.validateDisplayName(connectionInfo.petname);
              if (nameValidation.isValid) {
                displayName = nameValidation.sanitized;
              }
            }

            let relayUrl: string | undefined;
            if (connectionInfo.relayUrl) {
              const urlValidation = InputValidator.validateRelayUrl(connectionInfo.relayUrl);
              if (urlValidation.isValid) {
                relayUrl = connectionInfo.relayUrl;
              }
            }

            // Create connection
            const connection: Connection = {
              id: await cryptoService.generateInviteId(),
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

            await connectionStore.addConnection(connection);
            existingPublicKeys.add(normalizedPubkey); // Prevent duplicates within the same import
            result.successfulImports++;

            // Rate limiting to avoid overwhelming the system
            if (i < connectionData.connections.length - 1) {
              await delay(IMPORT_RATE_LIMIT_MS);
            }
          } catch (error) {
            result.failedImports++;
            result.errors.push({
              publicKey: connectionInfo.publicKey || 'unknown',
              error: error instanceof Error ? error.message : 'Unknown error',
              reason: 'validation_failed'
            });
          }
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Connection import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportConnections(): Promise<NostrConnectionList> {
    try {
      const connections = await connectionStore.getAllConnections();
      const nostrConnections = connections.map((connection: Connection) => ({
        publicKey: connection.publicKey,
        relayUrl: undefined, // Not stored yet
        petname: connection.displayName
      }));

      return {
        connections: nostrConnections,
        version: 1,
        createdAt: Math.floor(Date.now() / 1000)
      };
    } catch (error) {
      throw new Error(`Connection export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateConnectionListFormat(data: unknown): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!isRecord(data)) {
      errors.push('Data must be an object');
      return { isValid: false, errors };
    }

    const connectionsRaw: unknown = data.connections;
    if (!Array.isArray(connectionsRaw)) {
      errors.push('connections field must be an array');
      return { isValid: false, errors };
    }

    if (!isNumber(data.version)) {
      errors.push('version field must be a number');
    }

    if (!isNumber(data.createdAt)) {
      errors.push('createdAt field must be a number');
    }

    // Validate each connection
    for (let i = 0; i < connectionsRaw.length; i++) {
      const connection: unknown = connectionsRaw[i];

      if (!isRecord(connection)) {
        errors.push(`Connection at index ${i} must be an object`);
        continue;
      }

      const publicKey: unknown = connection.publicKey;
      if (!isString(publicKey) || publicKey.length === 0) {
        errors.push(`Connection at index ${i} missing valid publicKey`);
        continue;
      }

      if (!cryptoService.isValidPubkey(publicKey)) {
        errors.push(`Connection at index ${i} has invalid publicKey format`);
      }

      const petname: unknown = connection.petname;
      if (petname !== undefined && petname !== null && !isString(petname)) {
        errors.push(`Connection at index ${i} petname must be a string`);
      }

      const relayUrl: unknown = connection.relayUrl;
      if (relayUrl !== undefined && relayUrl !== null && !isString(relayUrl)) {
        errors.push(`Connection at index ${i} relayUrl must be a string`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  async importConnectionsFromFile(fileContent: string): Promise<ImportResult> {
    try {
      // Parse JSON
      let connectionData: unknown;
      try {
        connectionData = JSON.parse(fileContent);
      } catch {
        throw new Error('Invalid JSON format');
      }

      const parsed: NostrConnectionList | null = parseNostrConnectionList(connectionData);
      if (!parsed) {
        throw new Error('Invalid connection list format');
      }

      // Validate format
      const validation = await this.validateConnectionListFormat(connectionData);
      if (!validation.isValid) {
        throw new Error(`Invalid connection list format: ${validation.errors.join(', ')}`);
      }

      // Import connections
      return await this.importConnections(parsed);
    } catch (error) {
      throw new Error(`File import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportConnectionsToFile(): Promise<string> {
    try {
      const connectionData = await this.exportConnections();
      return JSON.stringify(connectionData, null, 2);
    } catch {
      throw new Error('File export failed');
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

  private async storeConnectionRequest(connectionRequest: ConnectionRequest): Promise<void> {
    // Check pending request limits
    await this.enforcePendingRequestLimits();

    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTION_REQUESTS_STORE);

      const request = store.add(connectionRequest);

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

  private async getConnectionRequest(requestId: string): Promise<ConnectionRequest | null> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_REQUESTS_STORE], 'readonly');
      const store = transaction.objectStore(CONNECTION_REQUESTS_STORE);

      const request = store.get(requestId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async updateConnectionRequestStatus(requestId: string, status: ConnectionRequestStatus): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTION_REQUESTS_STORE);

      const getRequest = store.get(requestId);

      getRequest.onsuccess = () => {
        const connectionRequest = getRequest.result;
        if (!connectionRequest) {
          reject(new Error('Connection request not found'));
          return;
        }

        connectionRequest.status = status;

        const putRequest = store.put(connectionRequest);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      };

      getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  private async findConnectionByPublicKey(publicKey: PublicKeyHex): Promise<Connection | null> {
    try {
      const connection = await connectionStore.getConnectionByPublicKey(publicKey);
      return connection;
    } catch {
      return null;
    }
  }

  private async enforcePendingRequestLimits(): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_REQUESTS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTION_REQUESTS_STORE);
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