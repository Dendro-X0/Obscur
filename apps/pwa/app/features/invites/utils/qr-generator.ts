import QRCodeLib from 'qrcode';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import { cryptoService } from '../../crypto/crypto-service';
import { qrCodeCache, performanceMonitor } from './performance-optimizations';

/**
 * QR code data structure for invite information
 */
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

/**
 * Generated QR code with multiple formats
 */
export interface QRCode {
  dataUrl: string;
  svgString: string;
  rawData: string;
  size: number;
}

/**
 * Options for QR code generation
 */
export interface QRInviteOptions {
  displayName?: string;
  avatar?: string;
  message?: string;
  expirationHours?: number;
  includeProfile?: boolean;
}

/**
 * QR Generator Service for creating and processing invite QR codes
 */
export interface QRGenerator {
  generateQR(data: QRInviteData): Promise<QRCode>;
  scanQR(imageData: ImageData): Promise<QRInviteData>;
  validateQRData(data: string): boolean;
  createInviteQR(publicKey: PublicKeyHex, privateKey: PrivateKeyHex, options?: QRInviteOptions): Promise<QRCode>;
  parseQRData(rawData: string): QRInviteData | null;
}

/**
 * QR Generator implementation
 */
class QRGeneratorImpl implements QRGenerator {
  private readonly QR_VERSION = '1.0';
  private readonly DEFAULT_EXPIRATION_HOURS = 24;
  private readonly QR_PREFIX = 'obscur-invite:';

  /**
   * Generate QR code from invite data
   */
  async generateQR(data: QRInviteData): Promise<QRCode> {
    const endTiming = performanceMonitor.start('qr-generation');

    try {
      // Validate input data
      await this.validateInviteData(data);

      // Create the raw data string
      const rawData = this.serializeInviteData(data);

      // Check cache first
      const cacheKey = qrCodeCache.generateKey(data.publicKey, {
        displayName: data.displayName,
        message: data.message,
        timestamp: data.timestamp
      });

      const cachedDataUrl = qrCodeCache.get(cacheKey);

      let dataUrl: string;
      let svgString: string;

      if (cachedDataUrl) {
        // Use cached data URL, but still generate SVG (lightweight)
        dataUrl = cachedDataUrl;
        svgString = await QRCodeLib.toString(rawData, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 256
        });
      } else {
        // Generate both formats
        [dataUrl, svgString] = await Promise.all([
          QRCodeLib.toDataURL(rawData, {
            errorCorrectionLevel: 'M',
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            width: 256
          }),
          QRCodeLib.toString(rawData, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 256
          })
        ]);

        // Cache the data URL
        qrCodeCache.set(cacheKey, dataUrl);
      }

      endTiming();

      return {
        dataUrl,
        svgString,
        rawData,
        size: 256
      };
    } catch (error) {
      endTiming();
      throw new Error(`QR code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create invite QR code from user data
   */
  async createInviteQR(
    publicKey: PublicKeyHex,
    privateKey: PrivateKeyHex,
    options: QRInviteOptions = {}
  ): Promise<QRCode> {
    try {
      const now = Date.now();
      const expirationHours = options.expirationHours ?? this.DEFAULT_EXPIRATION_HOURS;
      const expirationTime = now + (expirationHours * 60 * 60 * 1000);

      const inviteId: string = await cryptoService.generateInviteId();

      // Create invite data structure
      const inviteData = {
        publicKey,
        displayName: options.includeProfile ? options.displayName : undefined,
        avatar: options.includeProfile ? options.avatar : undefined,
        message: options.message,
        timestamp: now,
        expirationTime,
        inviteId
      };

      // Sign the invite data
      const signature = await cryptoService.signInviteData(inviteData, privateKey);

      // Create QR invite data
      const qrData: QRInviteData = {
        version: this.QR_VERSION,
        publicKey,
        displayName: inviteData.displayName,
        avatar: inviteData.avatar,
        message: inviteData.message,
        timestamp: inviteData.timestamp,
        expirationTime: inviteData.expirationTime,
        signature
      };

      return await this.generateQR(qrData);
    } catch (error) {
      throw new Error(`Invite QR creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scan QR code from image data
   */
  async scanQR(imageData: ImageData): Promise<QRInviteData> {
    // Import the scanning utility
    const { scanQRFromImageData } = await import('./qr-scanner-utils');
    return await scanQRFromImageData(imageData);
  }

  /**
   * Validate QR data format
   */
  validateQRData(data: string): boolean {
    try {
      if (!data || typeof data !== 'string') {
        return false;
      }

      // Check if it starts with our prefix
      if (!data.startsWith(this.QR_PREFIX)) {
        return false;
      }

      // Try to parse the data
      const parsed = this.parseQRData(data);
      return parsed !== null;
    } catch {
      return false;
    }
  }

  /**
   * Parse QR data string into invite data
   */
  parseQRData(rawData: string): QRInviteData | null {
    try {
      if (!rawData.startsWith(this.QR_PREFIX)) {
        return null;
      }

      // Remove prefix and decode
      const jsonData = rawData.slice(this.QR_PREFIX.length);
      const parsed = JSON.parse(jsonData);

      // Validate required fields
      if (!this.isValidQRInviteData(parsed)) {
        return null;
      }

      return parsed as QRInviteData;
    } catch {
      return null;
    }
  }

  /**
   * Serialize invite data to string format
   */
  private serializeInviteData(data: QRInviteData): string {
    const jsonData = JSON.stringify(data);
    return `${this.QR_PREFIX}${jsonData}`;
  }

  /**
   * Validate invite data structure
   */
  private async validateInviteData(data: QRInviteData): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid invite data: must be object');
    }

    if (!data.version || typeof data.version !== 'string') {
      throw new Error('Invalid invite data: version required');
    }

    if (!data.publicKey || typeof data.publicKey !== 'string') {
      throw new Error('Invalid invite data: publicKey required');
    }

    if (!(await cryptoService.isValidPubkey(data.publicKey))) {
      throw new Error('Invalid invite data: invalid publicKey format');
    }

    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      throw new Error('Invalid invite data: valid timestamp required');
    }

    if (typeof data.expirationTime !== 'number' || data.expirationTime <= data.timestamp) {
      throw new Error('Invalid invite data: valid expirationTime required');
    }

    if (!data.signature || typeof data.signature !== 'string') {
      throw new Error('Invalid invite data: signature required');
    }

    // Check if expired
    if (Date.now() > data.expirationTime) {
      throw new Error('Invite has expired');
    }
  }

  /**
   * Check if parsed data has valid QR invite structure
   */
  private isValidQRInviteData(data: unknown): data is QRInviteData {
    if (!data || typeof data !== 'object') {
      return false;
    }
    const candidate = data as Record<string, unknown>;
    if (typeof candidate.version !== 'string') {
      return false;
    }
    if (typeof candidate.publicKey !== 'string') {
      return false;
    }
    if (typeof candidate.timestamp !== 'number' || candidate.timestamp <= 0) {
      return false;
    }
    if (typeof candidate.expirationTime !== 'number' || candidate.expirationTime <= candidate.timestamp) {
      return false;
    }
    if (typeof candidate.signature !== 'string') {
      return false;
    }
    return true;
  }
}

/**
 * Singleton QR generator instance
 */
export const qrGenerator: QRGenerator = new QRGeneratorImpl();

/**
 * Hook for using QR generator in React components
 */
export const useQRGenerator = (): QRGenerator => {
  return qrGenerator;
};