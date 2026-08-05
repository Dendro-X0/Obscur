/**
 * Invites utils barrel — compatibility only.
 * Prefer leaf imports (`./utils`, `./invite-manager`, …).
 * Named re-exports replace prior `export *` wildcards (Phase A barrel trim).
 */
export type {
  TrustLevel,
  ConnectionRequestStatus,
  QRInviteOptions,
  InviteLinkOptions,
  QRInviteData,
  QRCode,
  Connection,
  ConnectionMetadata,
  ConnectionGroup,
  ConnectionFilter,
  ConnectionRequest,
  OutgoingConnectionRequest,
  InviteLink,
  UserProfile,
  PrivacySettings,
  ShareableProfile,
  ImportResult,
  ImportError,
  NostrConnectionList,
} from "./types";

export type {
  InviteManager,
  QRGenerator,
  ConnectionStore,
  ProfileManager,
  InviteCryptoService,
} from "./interfaces";

export {
  INVITE_DB_NAME,
  INVITE_DB_VERSION,
  CONNECTIONS_STORE,
  CONNECTION_GROUPS_STORE,
  CONNECTION_REQUESTS_STORE,
  INVITE_LINKS_STORE,
  USER_PROFILE_KEY,
  PRIVACY_SETTINGS_KEY,
  QR_CODE_VERSION,
  QR_CODE_SIZE,
  QR_CODE_ERROR_CORRECTION,
  INVITE_LINK_BASE_URL,
  SHORT_CODE_LENGTH,
  DEFAULT_INVITE_EXPIRATION_HOURS,
  MAX_PENDING_REQUESTS,
  MAX_CONNECTION_REQUEST_MESSAGE_LENGTH,
  MAX_IMPORT_BATCH_SIZE,
  IMPORT_RATE_LIMIT_MS,
  TRUST_LEVEL_COLORS,
  EXPIRATION_OPTIONS,
  ERROR_MESSAGES,
} from "./constants";

export {
  InviteError,
  QRCodeError,
  InviteLinkError,
  ConnectionError,
  CryptoError,
  StorageError,
  ValidationError,
  ImportExportError,
} from "./errors";

export {
  validatePublicKey,
  validateEmail,
  validateUrl,
  sanitizeInput,
  formatPublicKeyPreview,
  isExpired,
  generateRandomString,
  debounce,
  delay,
  validateDisplayName,
  validateConnectionMessage,
  formatDate,
  formatRelativeTime,
} from "./utils";

export { inviteManager, useInviteManager } from "./invite-manager";
export { connectionStore } from "./connection-store";
export { profileManager, useProfileManager } from "./profile-manager";
export { qrGenerator, useQRGenerator } from "./qr-generator";
