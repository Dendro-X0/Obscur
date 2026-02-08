import * as Comlink from "comlink";
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

// Internal implementation placeholder to allow type inference
let instance: Comlink.Remote<CryptoService> | CryptoService;

const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

if (typeof window !== "undefined" && typeof Worker !== "undefined" && !isTauri) {
  try {
    const worker = new Worker(new URL("./crypto.worker.ts", import.meta.url));
    instance = Comlink.wrap<CryptoService>(worker);
  } catch (error) {
    console.warn("Failed to initialize crypto worker, falling back to main thread:", error);
    instance = new CryptoServiceImpl();
  }
} else {
  // SSR, non-browser environment, or Tauri (where workers might hang during initial load)
  if (isTauri) {
    console.info("Running in Tauri: using NativeCryptoService for keychain support.");
    instance = new NativeCryptoService();
  } else {
    instance = new CryptoServiceImpl();
  }
}

/**
 * Singleton crypto service instance
 * In browser, this is a proxy to a Web Worker via Comlink.
 */
export const cryptoService = instance;

/**
 * Hook for using the crypto service in React components
 */
export const useCryptoService = (): CryptoService => {
  return cryptoService as unknown as CryptoService;
};