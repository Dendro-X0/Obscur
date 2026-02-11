import { CryptoServiceImpl } from "./crypto-service-impl";
import { NativeCryptoService } from "./native-crypto-service";
import type {
  CryptoService,
  SecurityUtils,
  UnsignedNostrEvent,
  InviteSignaturePayload,
  InviteData
} from "./crypto-interfaces";

export type {
  CryptoService,
  SecurityUtils,
  UnsignedNostrEvent,
  InviteSignaturePayload,
  InviteData
};

export { NATIVE_KEY_SENTINEL } from "./native-crypto-service";

/**
 * Resilient crypto service initialization
 * Falls back to main-thread implementation if Worker fails
 */
const initializeCryptoService = (): CryptoService => {
  const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

  // Tauri always uses native service for keychain support
  if (isTauri) {
    console.info("[CryptoService] Running in Tauri: using NativeCryptoService");
    return new NativeCryptoService();
  }

  // SSR or non-browser environment
  if (typeof window === "undefined") {
    return new CryptoServiceImpl();
  }

  // Browser: use main-thread implementation (Worker optimization removed for stability)
  // TODO: Re-enable Worker after fixing Comlink proxy issues
  console.info("[CryptoService] Using main-thread CryptoServiceImpl");
  return new CryptoServiceImpl();
};

/**
 * Singleton crypto service instance
 * Guaranteed to be a working implementation (no proxy failures)
 */
export const cryptoService: CryptoService = initializeCryptoService();

/**
 * Hook for using the crypto service in React components
 */
export const useCryptoService = (): CryptoService => {
  return cryptoService;
};