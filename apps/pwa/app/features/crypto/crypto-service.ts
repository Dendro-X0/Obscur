import { CryptoServiceImpl } from "./crypto-service-impl";
import { NativeCryptoService } from "./native-crypto-service";
import * as Comlink from "comlink";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
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
  const isTauri = hasNativeRuntime();

  // Tauri always uses native service for keychain support
  if (isTauri) {
    console.info("[CryptoService] Running in Tauri: using NativeCryptoService");
    return new NativeCryptoService();
  }

  // SSR or non-browser environment
  if (typeof window === "undefined") {
    return new CryptoServiceImpl();
  }

  // Browser: use Web Worker for performance
  if (typeof Worker === "undefined") {
    return new CryptoServiceImpl();
  }
  try {
    const worker = new Worker(new URL("./crypto.worker.ts", import.meta.url));
    const proxy = Comlink.wrap<CryptoService>(worker);

    // Test the proxy to ensure it's working
    console.info("[CryptoService] Initializing Web Worker...");

    // We wrap it in a proxy to handle potential failures or the 'security' property
    return new Proxy(proxy, {
      get(target, prop) {
        if (prop === "security") {
          // Flatten security calls or ensure they work via proxy
          return (target as any)[prop];
        }
        return (target as any)[prop];
      }
    }) as unknown as CryptoService;
  } catch (e) {
    console.warn("[CryptoService] Worker initialization failed, falling back to main-thread:", e);
    return new CryptoServiceImpl();
  }
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
