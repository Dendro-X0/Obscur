/**
 * Base error class for invite system errors
 */
export class InviteError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'InviteError';
  }
}

/**
 * Error thrown when QR code operations fail
 */
export class QRCodeError extends InviteError {
  constructor(message: string, cause?: Error) {
    super(message, 'QR_CODE_ERROR', cause);
    this.name = 'QRCodeError';
  }
}

/**
 * Error thrown when invite links are invalid or expired
 */
export class InviteLinkError extends InviteError {
  constructor(message: string, cause?: Error) {
    super(message, 'INVITE_LINK_ERROR', cause);
    this.name = 'InviteLinkError';
  }
}

/**
 * Error thrown when contact operations fail
 */
export class ContactError extends InviteError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONTACT_ERROR', cause);
    this.name = 'ContactError';
  }
}

/**
 * Error thrown when cryptographic operations fail
 */
export class CryptoError extends InviteError {
  constructor(message: string, cause?: Error) {
    super(message, 'CRYPTO_ERROR', cause);
    this.name = 'CryptoError';
  }
}

/**
 * Error thrown when storage operations fail
 */
export class StorageError extends InviteError {
  constructor(message: string, cause?: Error) {
    super(message, 'STORAGE_ERROR', cause);
    this.name = 'StorageError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends InviteError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when import/export operations fail
 */
export class ImportExportError extends InviteError {
  constructor(message: string, cause?: Error) {
    super(message, 'IMPORT_EXPORT_ERROR', cause);
    this.name = 'ImportExportError';
  }
}