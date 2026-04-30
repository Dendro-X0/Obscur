import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { generatePrivateKeyHex } from "@dweb/crypto/generate-private-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/**
 * Proof-of-Work Key Generator
 *
 * Generates identity keys that require computational work to create,
 * making mass account creation expensive for bots while remaining
 * feasible for legitimate users (~2-5 seconds on modern devices).
 *
 * The PoW requirement is based on the hash of the public key having
 * a specific number of leading zero bits (configurable difficulty).
 */

export type PoWDifficulty = "light" | "medium" | "hard";

export type PoWGenerationResult = Readonly<{
  privateKeyHex: PrivateKeyHex;
  publicKeyHex: PublicKeyHex;
  attempts: number;
  durationMs: number;
  difficulty: PoWDifficulty;
  zeroBits: number;
}>;

export type PoWProgressCallback = (progress: Readonly<{
  attempts: number;
  elapsedMs: number;
  hashesPerSecond: number;
}>) => void;

// Difficulty levels: number of leading zero bits required in SHA-256 hash
const DIFFICULTY_CONFIG: Readonly<Record<PoWDifficulty, number>> = {
  light: 4,   // ~16 attempts expected, <100ms
  medium: 8,  // ~256 attempts expected, ~1-2s
  hard: 12,   // ~4096 attempts expected, ~3-5s
};

/**
 * Count the number of leading zero bits in a byte array
 */
const countLeadingZeroBits = (bytes: Uint8Array): number => {
  let count = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      count += 8;
    } else {
      // Count leading zeros in this byte
      let mask = 0x80;
      while ((byte & mask) === 0) {
        count++;
        mask >>= 1;
      }
      break;
    }
  }
  return count;
};

/**
 * Check if a hash meets the difficulty requirement
 */
const meetsDifficultyRequirement = (hash: Uint8Array, requiredZeroBits: number): boolean => {
  return countLeadingZeroBits(hash) >= requiredZeroBits;
};

/**
 * Generate a SHA-256 hash of data
 */
const sha256 = async (data: Uint8Array): Promise<Uint8Array> => {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return new Uint8Array(hashBuffer);
};

/**
 * Convert hex string to Uint8Array
 */
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
};

/**
 * Generate a PoW identity key pair with the specified difficulty
 *
 * @param difficulty - The difficulty level (light/medium/hard)
 * @param onProgress - Optional callback for progress updates
 * @param abortSignal - Optional signal to abort generation
 * @returns The generated key pair with metadata
 */
export const generatePoWIdentity = async (
  difficulty: PoWDifficulty = "medium",
  onProgress?: PoWProgressCallback,
  abortSignal?: AbortSignal,
): Promise<PoWGenerationResult> => {
  const requiredZeroBits = DIFFICULTY_CONFIG[difficulty];
  const startTime = performance.now();
  let attempts = 0;
  let lastProgressTime = startTime;

  while (true) {
    // Check abort signal
    if (abortSignal?.aborted) {
      throw new Error("PoW generation aborted");
    }

    // Generate candidate key pair
    const privateKeyHex = generatePrivateKeyHex();
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    attempts++;

    // Hash the public key
    const publicKeyBytes = hexToBytes(publicKeyHex);
    const hash = await sha256(publicKeyBytes);

    // Check if it meets the difficulty requirement
    if (meetsDifficultyRequirement(hash, requiredZeroBits)) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        privateKeyHex,
        publicKeyHex,
        attempts,
        durationMs,
        difficulty,
        zeroBits: countLeadingZeroBits(hash),
      };
    }

    // Report progress every 100ms
    const now = performance.now();
    if (onProgress && now - lastProgressTime > 100) {
      const elapsedMs = now - startTime;
      const hashesPerSecond = Math.round((attempts / elapsedMs) * 1000);
      onProgress({
        attempts,
        elapsedMs: Math.round(elapsedMs),
        hashesPerSecond,
      });
      lastProgressTime = now;
    }

    // Yield to event loop every 100 attempts to prevent UI blocking
    if (attempts % 100 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
};

/**
 * Validate that a public key meets the PoW difficulty requirement
 *
 * @param publicKeyHex - The public key to validate
 * @param difficulty - The difficulty level to check against
 * @returns Whether the key meets the requirement
 */
export const validatePoWRequirement = async (
  publicKeyHex: PublicKeyHex,
  difficulty: PoWDifficulty = "medium",
): Promise<boolean> => {
  const requiredZeroBits = DIFFICULTY_CONFIG[difficulty];
  const publicKeyBytes = hexToBytes(publicKeyHex);
  const hash = await sha256(publicKeyBytes);
  return meetsDifficultyRequirement(hash, requiredZeroBits);
};

/**
 * Estimate the time required to generate a key at the given difficulty
 * based on the device's measured hash rate
 *
 * @param difficulty - The difficulty level
 * @param sampleHashes - Number of hashes to run for measurement (default: 100)
 * @returns Estimated time in milliseconds
 */
export const estimatePoWGenerationTime = async (
  difficulty: PoWDifficulty = "medium",
  sampleHashes: number = 100,
): Promise<number> => {
  const requiredZeroBits = DIFFICULTY_CONFIG[difficulty];
  const expectedAttempts = Math.pow(2, requiredZeroBits);

  // Measure hash rate
  const startTime = performance.now();
  for (let i = 0; i < sampleHashes; i++) {
    const privateKeyHex = generatePrivateKeyHex();
    const publicKeyHex = derivePublicKeyHex(privateKeyHex);
    const publicKeyBytes = hexToBytes(publicKeyHex);
    await sha256(publicKeyBytes);
  }
  const durationMs = performance.now() - startTime;
  const hashesPerMs = sampleHashes / durationMs;

  // Estimate time for expected attempts
  return Math.round(expectedAttempts / hashesPerMs);
};

/**
 * Get human-readable difficulty description
 */
export const getPoWDifficultyDescription = (difficulty: PoWDifficulty): string => {
  switch (difficulty) {
    case "light":
      return "Light (~100ms, 4 zero bits)";
    case "medium":
      return "Medium (~2-3s, 8 zero bits)";
    case "hard":
      return "Hard (~5-10s, 12 zero bits)";
    default:
      return "Unknown";
  }
};
