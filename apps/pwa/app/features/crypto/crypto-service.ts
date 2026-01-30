import * as Comlink from "comlink";
import { CryptoServiceImpl } from "./crypto-service-impl";
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

// Internal implementation placeholder to allow type inference
let instance: Comlink.Remote<CryptoService> | CryptoService;

if (typeof window !== "undefined" && typeof Worker !== "undefined") {
  try {
    const worker = new Worker(new URL("./crypto.worker.ts", import.meta.url));
    instance = Comlink.wrap<CryptoService>(worker);
  } catch (error) {
    console.warn("Failed to initialize crypto worker, falling back to main thread:", error);
    instance = new CryptoServiceImpl();
  }
} else {
  // SSR or non-browser environment (or during Vitest tests)
  instance = new CryptoServiceImpl();
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