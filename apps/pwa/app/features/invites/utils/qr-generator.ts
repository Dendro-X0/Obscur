import QRCodeLib from 'qrcode';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import type { PrivateKeyHex } from '@dweb/crypto/private-key-hex';
import { cryptoService } from '../../crypto/crypto-service';
import { qrCodeCache, performanceMonitor } from './performance-optimizations';

/**
 * QR code data structure for connection information
 */
export interface QRConnectionData {
  version: string;
  type?: string;
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
export interface QRConnectionOptions {
  displayName?: string;
  avatar?: string;
  message?: string;
  expirationHours?: number;
  includeProfile?: boolean;
}

/**
 * QR Generator Service for creating and processing connection QR codes
 */
export interface QRGenerator {
  generateQR(data: QRConnectionData): Promise<QRCode>;
  scanQR(imageData: ImageData): Promise<QRConnectionData>;
  validateQRData(data: string): boolean;
  createConnectionQR(publicKey: PublicKeyHex, privateKey: PrivateKeyHex, options?: QRConnectionOptions): Promise<QRCode>;
  createInviteQR(publicKey: PublicKeyHex, privateKey: PrivateKeyHex, options?: QRConnectionOptions): Promise<QRCode>;
  parseQRData(rawData: string): QRConnectionData | null;
}

/**
 * QR Generator implementation
 */
class QRGeneratorImpl implements QRGenerator {
  private readonly QR_VERSION = '1.0';
  private readonly DEFAULT_EXPIRATION_HOURS = 24;
  private readonly QR_PREFIX = 'obscur-connection:';
  private readonly LEGACY_QR_PREFIX = 'obscur-invite:';

  /**
   * Generate QR code from connection data
   */
  async generateQR(data: QRConnectionData): Promise<QRCode> {
    const endTiming = performanceMonitor.start('qr-generation');

    try {
      // Validate input data
      await this.validateConnectionData(data);

      // Create the raw data string
      const rawData = this.serializeConnectionData(data);

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
   * Create connection QR code from user data
   */
  async createConnectionQR(
    publicKey: PublicKeyHex,
    privateKey: PrivateKeyHex,
    options: QRConnectionOptions = {}
  ): Promise<QRCode> {
    try {
      const now = Date.now();
      const expirationHours = options.expirationHours ?? this.DEFAULT_EXPIRATION_HOURS;
      const expirationTime = now + (expirationHours * 60 * 60 * 1000);

      const inviteId: string = await cryptoService.generateInviteId();

      // Create connection data structure
      const connectionData = {
        publicKey,
        displayName: options.includeProfile ? options.displayName : undefined,
        avatar: options.includeProfile ? options.avatar : undefined,
        message: options.message,
        timestamp: now,
        expirationTime,
        inviteId
      };

      // Sign the connection data
      const signature = await cryptoService.signInviteData(connectionData, privateKey);

      // Create QR connection data
      const qrData: QRConnectionData = {
        version: this.QR_VERSION,
        type: 'qr',
        publicKey,
        displayName: connectionData.displayName,
        avatar: connectionData.avatar,
        message: connectionData.message,
        timestamp: connectionData.timestamp,
        expirationTime: connectionData.expirationTime,
        signature
      };

      return await this.generateQR(qrData);
    } catch (error) {
      throw new Error(`Connection QR creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Backward-compatible alias kept for older call sites/tests.
   */
  async createInviteQR(
    publicKey: PublicKeyHex,
    privateKey: PrivateKeyHex,
    options: QRConnectionOptions = {}
  ): Promise<QRCode> {
    return this.createConnectionQR(publicKey, privateKey, options);
  }

  /**
   * Scan QR code from image data
   */
  async scanQR(imageData: ImageData): Promise<QRConnectionData> {
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

      // Check if it starts with a known prefix
      if (!this.getMatchingPrefix(data)) {
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
   * Parse QR data string into connection data
   */
  parseQRData(rawData: string): QRConnectionData | null {
    try {
      const prefix = this.getMatchingPrefix(rawData);
      if (!prefix) {
        return null;
      }

      // Remove prefix and decode
      const jsonData = rawData.slice(prefix.length);
      const parsed = JSON.parse(jsonData);

      // Validate required fields
      if (!this.isValidQRConnectionData(parsed)) {
        return null;
      }

      return parsed as QRConnectionData;
    } catch {
      return null;
    }
  }

  /**
   * Serialize connection data to string format
   */
  private serializeConnectionData(data: QRConnectionData): string {
    const jsonData = JSON.stringify(data);
    return `${this.QR_PREFIX}${jsonData}`;
  }

  private getMatchingPrefix(rawData: string): string | null {
    if (rawData.startsWith(this.QR_PREFIX)) {
      return this.QR_PREFIX;
    }
    if (rawData.startsWith(this.LEGACY_QR_PREFIX)) {
      return this.LEGACY_QR_PREFIX;
    }
    return null;
  }

  /**
   * Validate connection data structure
   */
  private async validateConnectionData(data: QRConnectionData): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid connection data: must be object');
    }

    if (!data.version || typeof data.version !== 'string') {
      throw new Error('Invalid connection data: version required');
    }

    if (!data.publicKey || typeof data.publicKey !== 'string') {
      throw new Error('Invalid connection data: publicKey required');
    }

    if (!(await cryptoService.isValidPubkey(data.publicKey))) {
      throw new Error('Invalid connection data: invalid publicKey format');
    }

    if (typeof data.timestamp !== 'number' || data.timestamp <= 0) {
      throw new Error('Invalid connection data: valid timestamp required');
    }

    if (typeof data.expirationTime !== 'number' || data.expirationTime <= data.timestamp) {
      throw new Error('Invalid connection data: valid expirationTime required');
    }

    if (!data.signature || typeof data.signature !== 'string') {
      throw new Error('Invalid connection data: signature required');
    }

    // Check if expired
    if (Date.now() > data.expirationTime) {
      throw new Error('Connection has expired');
    }
  }

  /**
   * Check if parsed data has valid QR connection structure
   */
  private isValidQRConnectionData(data: unknown): data is QRConnectionData {
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
