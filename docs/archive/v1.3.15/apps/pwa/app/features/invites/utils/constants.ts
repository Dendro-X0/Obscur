// Database and storage constants
export const INVITE_DB_NAME = 'obscur-invites';
export const INVITE_DB_VERSION = 3;

// Object store names
export const CONNECTIONS_STORE = 'connections';
export const CONNECTION_GROUPS_STORE = 'connection-groups';
export const CONNECTION_REQUESTS_STORE = 'connection-requests';
export const INVITE_LINKS_STORE = 'invite-links';

// Storage keys
export const USER_PROFILE_KEY = 'user-profile';
export const PRIVACY_SETTINGS_KEY = 'privacy-settings';

// QR Code configuration
export const QR_CODE_VERSION = '1.0';
export const QR_CODE_SIZE = 256;
export const QR_CODE_ERROR_CORRECTION = 'M';

// Invite link configuration
export const INVITE_LINK_BASE_URL = typeof window !== "undefined" ? `${window.location.origin}/invite` : 'https://obscur.app/invite';
export const SHORT_CODE_LENGTH = 8;
export const DEFAULT_INVITE_EXPIRATION_HOURS = 24;

// Connection request limits
export const MAX_PENDING_REQUESTS = 50;
export const MAX_CONNECTION_REQUEST_MESSAGE_LENGTH = 500;

// Import/export limits
export const MAX_IMPORT_BATCH_SIZE = 1000;
export const IMPORT_RATE_LIMIT_MS = 100; // 100ms between requests

// Trust level colors (for UI)
export const TRUST_LEVEL_COLORS = {
  trusted: '#10b981', // green-500
  neutral: '#6b7280', // gray-500
  blocked: '#ef4444', // red-500
} as const;

// Default expiration times
export const EXPIRATION_OPTIONS = {
  '1h': 1 * 60 * 60 * 1000, // 1 hour
  '1d': 24 * 60 * 60 * 1000, // 1 day
  '1w': 7 * 24 * 60 * 60 * 1000, // 1 week
  never: null,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_QR_CODE: 'Invalid QR code format',
  EXPIRED_INVITE: 'This invite has expired',
  INVALID_SIGNATURE: 'Invalid cryptographic signature',
  CONNECTION_NOT_FOUND: 'Connection not found',
  DUPLICATE_CONNECTION: 'Connection already exists',
  INVALID_PUBLIC_KEY: 'Invalid public key format',
  STORAGE_ERROR: 'Failed to access local storage',
  NETWORK_ERROR: 'Network connection failed',
  VALIDATION_ERROR: 'Data validation failed',
} as const;