import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';
import { ValidationError } from './errors';

/**
 * Validates a public key hex string
 */
export function validatePublicKey(publicKey: string): publicKey is PublicKeyHex {
  // Nostr public keys are 64 character hex strings (32 bytes)
  const hexRegex = /^[0-9a-fA-F]{64}$/;
  return hexRegex.test(publicKey);
}

/**
 * Validates an email address format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}

/**
 * Generates a short display version of a public key
 */
export function formatPublicKeyPreview(publicKey: PublicKeyHex): string {
  if (!validatePublicKey(publicKey)) {
    throw new ValidationError('Invalid public key format');
  }
  return `${publicKey.slice(0, 8)}...${publicKey.slice(-8)}`;
}

/**
 * Checks if a timestamp is expired
 */
export function isExpired(expirationTime: number): boolean {
  return Date.now() > expirationTime;
}

/**
 * Generates a random string of specified length
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);

  for (let i = 0; i < length; i++) {
    result += chars[randomArray[i] % chars.length];
  }

  return result;
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Creates a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates contact display name
 */
export function validateDisplayName(name: string): boolean {
  return name.length > 0 && name.length <= 50 && name.trim() === name;
}

/**
 * Validates contact message
 */
export function validateContactMessage(message: string): boolean {
  return message.length <= 500;
}

/**
 * Formats a date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formats a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) {
    return 'just now';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(date);
}