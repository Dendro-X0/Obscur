import jsQR from 'jsqr';
import type { QRInviteData } from './qr-generator';
import { qrGenerator } from './qr-generator';

/**
 * QR Scanner utilities for processing QR codes from various sources
 */

/**
 * Scan QR code from image file
 */
export async function scanQRFromFile(file: File): Promise<QRInviteData> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type: must be an image');
    }

    // Create image element
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // Load image
    const imageData = await new Promise<ImageData>((resolve, reject) => {
      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve(imageData);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      
      // Convert file to data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    return await scanQRFromImageData(imageData);
  } catch (error) {
    throw new Error(`QR scan from file failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Scan QR code from camera stream
 */
export async function scanQRFromCamera(): Promise<QRInviteData> {
  try {
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Use back camera if available
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    // Create video element
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve();
    });

    // Create canvas for frame capture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Canvas context not available');
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Scan frames until QR code is found
    return new Promise<QRInviteData>((resolve, reject) => {
      const scanFrame = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          scanQRFromImageData(imageData)
            .then((result) => {
              // Stop camera stream
              stream.getTracks().forEach(track => track.stop());
              resolve(result);
            })
            .catch(() => {
              // Continue scanning
              requestAnimationFrame(scanFrame);
            });
        } catch (error) {
          stream.getTracks().forEach(track => track.stop());
          reject(error);
        }
      };

      // Start scanning
      scanFrame();

      // Timeout after 30 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        reject(new Error('QR scan timeout - no valid QR code found'));
      }, 30000);
    });
  } catch (error) {
    throw new Error(`Camera QR scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Scan QR code from ImageData
 */
export async function scanQRFromImageData(imageData: ImageData): Promise<QRInviteData> {
  try {
    // Use jsQR to decode the QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (!code) {
      throw new Error('No QR code found in image');
    }

    // Validate QR data format
    if (!qrGenerator.validateQRData(code.data)) {
      throw new Error('Invalid QR code format - not an Obscur invite');
    }

    // Parse QR data
    const inviteData = qrGenerator.parseQRData(code.data);
    if (!inviteData) {
      throw new Error('Failed to parse QR code data');
    }

    // Check expiration
    if (Date.now() > inviteData.expirationTime) {
      throw new Error('Invite has expired');
    }

    return inviteData;
  } catch (error) {
    throw new Error(`QR scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Process QR code from clipboard (if it contains a data URL)
 */
export async function scanQRFromClipboard(): Promise<QRInviteData> {
  try {
    // Check if clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.read) {
      throw new Error('Clipboard API not available');
    }

    // Read clipboard items
    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      // Look for image data
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const file = new File([blob], 'clipboard-image', { type });
          return await scanQRFromFile(file);
        }
      }
    }

    throw new Error('No image found in clipboard');
  } catch (error) {
    throw new Error(`Clipboard QR scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate camera permissions
 */
export async function checkCameraPermission(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }

    // Check permission status if available
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return permission.state === 'granted';
    }

    // Fallback: try to access camera briefly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Request camera permission
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch {
    return false;
  }
}